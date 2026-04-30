import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ApiClient } from "../../lib/api-client";
import type { PortfolioSnapshot, SummaryMetric, TaskJob, WorkbenchAnalysisResult, WorkbenchSnapshot } from "../../lib/page-models";
import { apiClient } from "../../lib/api-client";
import { t } from "../../lib/i18n";
import { PageHeader } from "../../components/ui/page-header";
import { WorkbenchCard } from "../../components/ui/workbench-card";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../../components/ui/page-state";
import { Sparkline } from "../../components/ui/sparkline";
import { MarkdownBlock } from "../../components/ui/markdown-block";

type PositionFormState = {
  quantity: string;
  costPrice: string;
  takeProfit: string;
  stopLoss: string;
};

type PortfolioPositionPageProps = {
  client?: ApiClient;
};

type StockAnalysisPayload = WorkbenchSnapshot["analysis"];

const EMPTY_FORM: PositionFormState = {
  quantity: "",
  costPrice: "",
  takeProfit: "",
  stopLoss: "",
};

const STOCK_ANALYSIS_ANALYSTS = ["technical", "fundamental", "fund_flow", "risk"];
const STOCK_ANALYSIS_OPTIONS = [
  { label: "技术分析师", value: "technical" },
  { label: "基本面分析师", value: "fundamental" },
  { label: "资金流分析师", value: "fund_flow" },
  { label: "风险分析师", value: "risk" },
  { label: "情绪分析师", value: "sentiment" },
  { label: "新闻分析师", value: "news" },
];
const STOCK_ANALYSIS_CYCLES = ["1y", "1d", "30m"];
const STOCK_ANALYSIS_POLL_INTERVAL_MS = 1500;
const STOCK_ANALYSIS_POLL_LIMIT = 40;
const PORTFOLIO_POSITION_CACHE_PREFIX = "portfolio-position-snapshot:";

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const signalPillClassName = (value?: string) => {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized.includes("BUY") || normalized.includes("买")) return "signal-pill signal-pill--buy";
  if (normalized.includes("SELL") || normalized.includes("卖")) return "signal-pill signal-pill--sell";
  if (normalized.includes("HOLD") || normalized.includes("持")) return "signal-pill signal-pill--hold";
  return "signal-pill";
};

const isMeaningfulPositionValue = (value?: string) => {
  const normalized = (value ?? "").trim();
  if (!normalized || normalized === "--") return false;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0;
};

const singleStockActionLabel = (signal?: string, rating?: string, hasPosition = false) => {
  const normalizedSignal = (signal ?? "").trim().toUpperCase();
  if (normalizedSignal.includes("BUY") || normalizedSignal.includes("买")) {
    return hasPosition ? "加仓" : "建仓";
  }
  if (normalizedSignal.includes("SELL") || normalizedSignal.includes("卖")) {
    return hasPosition ? "卖出/减仓" : "回避";
  }
  if (normalizedSignal.includes("HOLD") || normalizedSignal.includes("持")) {
    return hasPosition ? "持有" : "观望";
  }
  const normalizedRating = (rating ?? "").trim();
  return normalizedRating && normalizedRating !== "--" ? normalizedRating : "--";
};

const normalizeSymbolForCompare = (value?: string) => (value ?? "").trim().toUpperCase();

const portfolioPositionCacheKey = (symbol: string) => `${PORTFOLIO_POSITION_CACHE_PREFIX}${normalizeSymbolForCompare(symbol)}`;

const isPortfolioSnapshotForSymbol = (value: unknown, symbol: string): value is PortfolioSnapshot => {
  const snapshot = value as PortfolioSnapshot | null;
  const detailSymbol = normalizeSymbolForCompare(snapshot?.detail?.symbol);
  return Boolean(snapshot && typeof snapshot === "object" && detailSymbol && detailSymbol === normalizeSymbolForCompare(symbol));
};

const readCachedPortfolioSnapshot = (symbol: string): PortfolioSnapshot | null => {
  if (!symbol || typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(portfolioPositionCacheKey(symbol));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return isPortfolioSnapshotForSymbol(parsed, symbol) ? parsed : null;
  } catch {
    return null;
  }
};

const writeCachedPortfolioSnapshot = (symbol: string, snapshot: PortfolioSnapshot | null) => {
  if (!symbol || !isPortfolioSnapshotForSymbol(snapshot, symbol) || typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(portfolioPositionCacheKey(symbol), JSON.stringify(snapshot));
  } catch {
    // Storage can fail in private mode or quota pressure; rendering must not depend on it.
  }
};

const normalizeIndicatorKey = (value?: string) => normalizeSymbolForCompare(value).replace(/\s+/g, "");

const pickTopIndicators = (indicators: SummaryMetric[] | undefined, count = 8): SummaryMetric[] => {
  const source = indicators ?? [];
  const selected: SummaryMetric[] = [];
  const selectedKeys = new Set<string>();
  const preferredKeywords = [
    ["现价", "当前价", "最新价", "price"],
    ["成交量", "成交额", "5日均量", "volume"],
    ["MA20", "20日均线"],
    ["MA60", "60日", "60-day"],
    ["RSI", "rsi14"],
    ["MACD"],
    ["布林上轨", "boll_upper", "upper volatility"],
    ["量比", "volume_ratio"],
    ["MA5", "5日均线"],
    ["K值", "kdj_k", "kdj fast"],
    ["D值", "kdj_d", "kdj slow"],
    ["MA10", "10日均线"],
    ["布林下轨", "boll_lower", "lower volatility"],
    ["信号线", "DEA", "macd_signal"],
  ];

  const addIndicator = (indicator: SummaryMetric | null | undefined) => {
    if (!indicator || selected.length >= count) return;
    const key = normalizeIndicatorKey(indicator.label);
    if (!key || selectedKeys.has(key)) return;
    selected.push(indicator);
    selectedKeys.add(key);
  };

  const findByKeywords = (keywords: string[]) =>
    source.find((indicator) => {
      const label = normalizeIndicatorKey(indicator.label);
      const fullText = normalizeIndicatorKey(`${indicator.label} ${indicator.hint ?? ""}`);
      return keywords.some((keyword) => {
        const normalized = normalizeIndicatorKey(keyword);
        return label.includes(normalized) || fullText.includes(normalized);
      });
    }) ?? null;

  preferredKeywords.forEach((keywords) => addIndicator(findByKeywords(keywords)));
  source.forEach(addIndicator);
  return selected.slice(0, count);
};

const parseIndicatorNumber = (value?: string) => {
  const normalized = (value ?? "").replace(/,/g, "").replace(/%/g, "").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const findIndicator = (indicators: SummaryMetric[] | undefined, keywords: string[]) => {
  const source = indicators ?? [];
  return (
    source.find((indicator) => {
      const label = normalizeIndicatorKey(indicator.label);
      const fullText = normalizeIndicatorKey(`${indicator.label} ${indicator.hint ?? ""}`);
      return keywords.some((keyword) => {
        const normalized = normalizeIndicatorKey(keyword);
        return label.includes(normalized) || fullText.includes(normalized);
      });
    }) ?? null
  );
};

const metricValue = (metric: SummaryMetric | null | undefined) => metric?.value ?? "--";
const metricNumber = (metric: SummaryMetric | null | undefined) => parseIndicatorNumber(metric?.value);

type TechnicalTone = "positive" | "warning" | "danger" | "neutral";

const statusToneClass = (tone: TechnicalTone) => `portfolio-technical-status-pill portfolio-technical-status-pill--${tone}`;

const buildTechnicalView = (indicators: SummaryMetric[] | undefined, latestPrice: string) => {
  const price = findIndicator(indicators, ["现价", "当前价", "最新价", "price"]) ?? { label: "现价", value: latestPrice };
  const volume = findIndicator(indicators, ["成交量", "volume"]);
  const volumeMa5 = findIndicator(indicators, ["5日均量", "volume_ma5", "Volume MA5"]);
  const ma5 = findIndicator(indicators, ["MA5", "5日均线", "5-day"]);
  const ma10 = findIndicator(indicators, ["MA10", "10日均线", "10-day"]);
  const ma20 = findIndicator(indicators, ["MA20", "20日均线", "20-day"]);
  const ma60 = findIndicator(indicators, ["MA60", "60日均线", "60-day"]);
  const rsi = findIndicator(indicators, ["RSI", "rsi14"]);
  const macd = findIndicator(indicators, ["MACD"]);
  const macdBar = findIndicator(indicators, ["MACD柱", "hist"]);
  const signalLine = findIndicator(indicators, ["信号线", "DEA", "macd_signal"]);
  const bollUpper = findIndicator(indicators, ["布林上轨", "boll_upper", "upper volatility"]);
  const bollMid = findIndicator(indicators, ["布林中轨", "boll_mid", "middle volatility"]);
  const bollLower = findIndicator(indicators, ["布林下轨", "boll_lower", "lower volatility"]);
  const kValue = findIndicator(indicators, ["K值", "kdj_k"]);
  const dValue = findIndicator(indicators, ["D值", "kdj_d"]);
  const volumeRatio = findIndicator(indicators, ["量比", "volume_ratio"]);

  const priceNum = metricNumber(price);
  const ma5Num = metricNumber(ma5);
  const ma20Num = metricNumber(ma20);
  const ma60Num = metricNumber(ma60);
  const rsiNum = metricNumber(rsi);
  const macdNum = metricNumber(macd);
  const signalNum = metricNumber(signalLine);
  const macdBarNum = metricNumber(macdBar);
  const upperNum = metricNumber(bollUpper);
  const midNum = metricNumber(bollMid);
  const lowerNum = metricNumber(bollLower);
  const volumeNum = metricNumber(volume);
  const volumeMa5Num = metricNumber(volumeMa5);
  const volumeRatioNum = metricNumber(volumeRatio);

  const trendTone: TechnicalTone = priceNum !== null && ma5Num !== null && ma20Num !== null && ma60Num !== null && priceNum > ma5Num && ma5Num > ma20Num && ma20Num > ma60Num
    ? "positive"
    : priceNum !== null && ma5Num !== null && ma20Num !== null && ma60Num !== null && priceNum < ma5Num && ma5Num < ma20Num && ma20Num < ma60Num
      ? "danger"
      : "warning";
  const trendLabel = trendTone === "positive" ? "趋势偏强" : trendTone === "danger" ? "趋势偏弱" : "趋势中性";
  const momentumTone: TechnicalTone = macdBarNum !== null ? (macdBarNum > 0 ? "positive" : macdBarNum < 0 ? "danger" : "neutral") : "neutral";
  const momentumLabel = momentumTone === "positive" ? "动量转强" : momentumTone === "danger" ? "动量转弱" : "动量中性";
  const rsiLabel = rsiNum === null ? "RSI --" : rsiNum >= 70 ? "RSI 偏热" : rsiNum <= 30 ? "RSI 偏冷" : "RSI 中性";
  const volatilityTone: TechnicalTone = priceNum !== null && upperNum !== null && priceNum >= upperNum
    ? "warning"
    : priceNum !== null && lowerNum !== null && priceNum <= lowerNum
      ? "danger"
      : "neutral";
  const volatilityLabel = priceNum !== null && midNum !== null && priceNum >= midNum ? "中轨上方" : "中轨下方";
  const volumeTone: TechnicalTone = volumeRatioNum !== null ? (volumeRatioNum >= 1.2 ? "positive" : volumeRatioNum <= 0.8 ? "warning" : "neutral") : "neutral";
  const volumeLabel = volumeRatioNum === null ? "量能 --" : volumeRatioNum >= 1.2 ? "量能放大" : volumeRatioNum <= 0.8 ? "量能偏弱" : "量能平稳";

  const axisMetrics = [
    { key: "bollLower", label: "布林下轨", metric: bollLower, value: lowerNum },
    { key: "ma20", label: "MA20", metric: ma20, value: ma20Num },
    { key: "price", label: "现价", metric: price, value: priceNum },
    { key: "ma5", label: "MA5", metric: ma5, value: ma5Num },
    { key: "ma60", label: "MA60", metric: ma60, value: ma60Num },
    { key: "bollUpper", label: "布林上轨", metric: bollUpper, value: upperNum },
  ].filter((item) => item.value !== null) as Array<{ key: string; label: string; metric: SummaryMetric | null; value: number }>;
  const axisMin = axisMetrics.length ? Math.min(...axisMetrics.map((item) => item.value)) : 0;
  const axisMax = axisMetrics.length ? Math.max(...axisMetrics.map((item) => item.value)) : 0;
  const axisRange = axisMax - axisMin || 1;

  return {
    status: [
      { label: "趋势", value: trendLabel, tone: trendTone },
      { label: "动量", value: momentumLabel, tone: momentumTone },
      { label: "波动", value: volatilityLabel, tone: volatilityTone },
      { label: "量能", value: volumeLabel, tone: volumeTone },
    ],
    metrics: { price, ma5, ma10, ma20, ma60, rsi, macd, macdBar, signalLine, bollUpper, bollMid, bollLower, kValue, dValue, volume, volumeMa5, volumeRatio },
    axis: axisMetrics.map((item) => ({
      ...item,
      pct: Math.max(0, Math.min(100, ((item.value - axisMin) / axisRange) * 100)),
    })).sort((a, b) => a.value - b.value),
    comments: {
      trend: priceNum !== null && ma5Num !== null && ma20Num !== null
        ? `现价 ${metricValue(price)}，相对 MA5 ${metricValue(ma5)}、MA20 ${metricValue(ma20)}；${trendLabel}。`
        : "均线数据不足，暂不判断趋势结构。",
      momentum: `MACD ${metricValue(macd)}，信号线 ${metricValue(signalLine)}，柱体 ${metricValue(macdBar)}；${rsiLabel}。`,
      volume: volumeNum !== null && volumeMa5Num !== null
        ? `成交量 ${metricValue(volume)}，5日均量 ${metricValue(volumeMa5)}，量比 ${metricValue(volumeRatio)}。`
        : `量比 ${metricValue(volumeRatio)}，等待成交量基准确认。`,
    },
  };
};

const stockAnalysisTextLength = (analysis?: StockAnalysisPayload | null) => {
  if (!analysis) {
    return 0;
  }
  const insightText = (analysis.insights ?? []).map((item) => `${item.title}\n${item.body}`);
  const analystText = (analysis.analystViews ?? []).map((item) => `${item.title}\n${item.body}`);
  return [
    analysis.summaryTitle,
    analysis.summaryBody,
    analysis.decision,
    analysis.finalDecisionText,
    ...insightText,
    ...analystText,
  ].join("\n").length;
};

const pickStockAnalysis = (
  current: StockAnalysisPayload | null | undefined,
  incoming: StockAnalysisPayload | null | undefined,
): StockAnalysisPayload | null | undefined => {
  if (!current) {
    return incoming;
  }
  if (!incoming) {
    return current;
  }
  const currentSymbol = normalizeSymbolForCompare(current.symbol);
  const incomingSymbol = normalizeSymbolForCompare(incoming.symbol);
  if (currentSymbol && incomingSymbol && currentSymbol !== incomingSymbol) {
    return incoming;
  }
  if (current.generatedAt && incoming.generatedAt) {
    if (incoming.generatedAt > current.generatedAt) {
      return incoming;
    }
    if (current.generatedAt > incoming.generatedAt) {
      return current;
    }
  }
  const incomingLength = stockAnalysisTextLength(incoming);
  if (incomingLength > 0) {
    return incoming;
  }
  return current;
};

const isMergedStockInsight = (title?: string) => {
  const normalized = title?.trim() ?? "";
  return normalized.includes("操作建议") || normalized.includes("风险提示");
};

const buildFinalDecisionContent = (analysis: StockAnalysisPayload) => {
  const parts = [analysis.finalDecisionText || analysis.decision || "暂无最终建议"];
  (analysis.insights ?? [])
    .filter((insight) => isMergedStockInsight(insight.title))
    .forEach((insight) => {
      parts.push(`\n\n**${insight.title}**\n\n${insight.body}`);
    });
  return parts.join("");
};

const mergePortfolioSnapshot = (current: PortfolioSnapshot | null, incoming: PortfolioSnapshot | null | undefined): PortfolioSnapshot | null => {
  if (!incoming) {
    return current;
  }
  const currentDetail = current?.detail;
  const incomingDetail = incoming.detail;
  if (!currentDetail || !incomingDetail || currentDetail.symbol !== incomingDetail.symbol) {
    return incoming;
  }

  const currentKline = currentDetail.kline ?? [];
  const incomingKline = incomingDetail.kline ?? [];
  const currentIndicators = currentDetail.indicators ?? [];
  const incomingIndicators = incomingDetail.indicators ?? [];
  const mergedKline = currentKline.length > incomingKline.length ? currentKline : incomingKline;
  const mergedIndicators = currentIndicators.length > incomingIndicators.length ? currentIndicators : incomingIndicators;
  const mergedStockAnalysis = pickStockAnalysis(currentDetail.stockAnalysis, incomingDetail.stockAnalysis);

  if (mergedKline === incomingKline && mergedIndicators === incomingIndicators && mergedStockAnalysis === incomingDetail.stockAnalysis) {
    return incoming;
  }

  return {
    ...incoming,
    curve: (incoming.curve?.length ?? 0) >= mergedKline.length ? incoming.curve : mergedKline,
    detail: {
      ...incomingDetail,
      kline: mergedKline,
      indicators: mergedIndicators,
      stockAnalysis: mergedStockAnalysis ?? null,
    },
  };
};

const applyStockAnalysis = (snapshot: PortfolioSnapshot | null, analysis: StockAnalysisPayload | null | undefined): PortfolioSnapshot | null => {
  if (!snapshot?.detail || !analysis) {
    return snapshot;
  }
  const detailSymbol = normalizeSymbolForCompare(snapshot.detail.symbol);
  const analysisSymbol = normalizeSymbolForCompare(analysis.symbol);
  if (detailSymbol && analysisSymbol && detailSymbol !== analysisSymbol) {
    return snapshot;
  }
  return {
    ...snapshot,
    detail: {
      ...snapshot.detail,
      stockAnalysis: pickStockAnalysis(snapshot.detail.stockAnalysis, analysis) ?? analysis,
    },
  };
};

const toStockAnalysisPayload = (analysis: WorkbenchAnalysisResult | StockAnalysisPayload | null | undefined): StockAnalysisPayload | null => {
  if (!analysis) {
    return null;
  }
  return {
    ...analysis,
    analysts: analysis.analysts ?? [],
    mode: analysis.mode ?? "单个分析",
    cycle: analysis.cycle ?? "1y",
    inputHint: analysis.inputHint ?? analysis.symbol,
    indicators: analysis.indicators ?? [],
    insights: analysis.insights ?? [],
    analystViews: analysis.analystViews ?? [],
    curve: analysis.curve ?? [],
  };
};

const taskResultForSymbol = (job: TaskJob | null | undefined, symbol: string): StockAnalysisPayload | null => {
  const normalizedSymbol = normalizeSymbolForCompare(symbol);
  const results = job?.results ?? [];
  const matched = results.find((item) => normalizeSymbolForCompare(item?.symbol) === normalizedSymbol);
  return toStockAnalysisPayload(matched);
};

export function PortfolioPositionPage({ client = apiClient }: PortfolioPositionPageProps) {
  const { symbol = "" } = useParams<{ symbol: string }>();
  const normalizedSymbol = symbol.trim();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(() => readCachedPortfolioSnapshot(normalizedSymbol));
  const [status, setStatus] = useState<"loading" | "ready" | "error">(() =>
    readCachedPortfolioSnapshot(normalizedSymbol) ? "ready" : "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PositionFormState>(EMPTY_FORM);
  const [isStockAnalysisUpdating, setIsStockAnalysisUpdating] = useState(false);
  const [isDetailRefreshing, setIsDetailRefreshing] = useState(false);
  const [stockAnalysisStatus, setStockAnalysisStatus] = useState<string>("");
  const [stockAnalysisJob, setStockAnalysisJob] = useState<TaskJob | null>(null);
  const [activeAnalystTitle, setActiveAnalystTitle] = useState<string>("");
  const [selectedStockAnalysisAnalysts, setSelectedStockAnalysisAnalysts] = useState<string[]>(STOCK_ANALYSIS_ANALYSTS);
  const [stockAnalysisCycle, setStockAnalysisCycle] = useState("1y");
  const autoRealtimeRefreshRef = useRef("");
  const analysisControlsSymbolRef = useRef("");
  const analysisControlsDirtyRef = useRef(false);

  useEffect(() => {
    const cached = readCachedPortfolioSnapshot(normalizedSymbol);
    setSnapshot(cached);
    setStatus(cached ? "ready" : "loading");
    setError(null);
  }, [normalizedSymbol]);

  const load = useCallback(async (options?: { showLoading?: boolean }) => {
    if (!normalizedSymbol) return;
    if (options?.showLoading !== false) {
      setStatus("loading");
    }
    setError(null);
    try {
      const response = await client.getPortfolioPosition<PortfolioSnapshot>(normalizedSymbol);
      setSnapshot((current) => {
        const merged = mergePortfolioSnapshot(current, response);
        writeCachedPortfolioSnapshot(normalizedSymbol, merged);
        return merged;
      });
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [client, normalizedSymbol]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const detail = snapshot?.detail;
    if (!detail) return;
    setForm({
      quantity: detail.positionForm?.quantity ?? "",
      costPrice: detail.positionForm?.costPrice ?? "",
      takeProfit: detail.positionForm?.takeProfit ?? "",
      stopLoss: detail.positionForm?.stopLoss ?? "",
    });
  }, [snapshot?.updatedAt, snapshot?.detail?.symbol]);

  const refreshRealtimeData = useCallback(async (options?: { silent?: boolean }) => {
    if (!normalizedSymbol) return null;
    if (!options?.silent) {
      setIsDetailRefreshing(true);
      setStockAnalysisStatus("正在刷新实时行情、K线和技术指标...");
    }
    try {
      const response = await client.runPageAction<PortfolioSnapshot>("portfolio", "refresh-indicators", {
        symbols: [normalizedSymbol],
        selectedSymbol: normalizedSymbol,
        scope: "indicators_only",
      });
      setSnapshot((current) => {
        const merged = mergePortfolioSnapshot(current, response);
        writeCachedPortfolioSnapshot(normalizedSymbol, merged);
        return merged;
      });
      setStatus("ready");
      setError(null);
      if (!options?.silent) {
        setStockAnalysisStatus("实时行情、K线和技术指标已刷新。");
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (options?.silent) {
        setStockAnalysisStatus(`实时行情、K线和技术指标刷新失败：${message}`);
      } else {
        setError(message);
        setStatus("error");
      }
      return null;
    } finally {
      if (!options?.silent) {
        setIsDetailRefreshing(false);
      }
    }
  }, [client, normalizedSymbol]);

  useEffect(() => {
    const detailSymbol = snapshot?.detail?.symbol?.trim();
    if (!detailSymbol || detailSymbol !== normalizedSymbol || autoRealtimeRefreshRef.current === normalizedSymbol) {
      return;
    }
    autoRealtimeRefreshRef.current = normalizedSymbol;
    setStockAnalysisStatus("正在刷新实时行情、K线和技术指标...");
    void refreshRealtimeData({ silent: true }).then((result) => {
      if (result) {
        setStockAnalysisStatus((current) => (current === "正在刷新实时行情、K线和技术指标..." ? "实时行情、K线和技术指标已刷新。" : current));
      }
    });
  }, [normalizedSymbol, refreshRealtimeData, snapshot?.detail?.symbol]);

  useEffect(() => {
    const analystViews = snapshot?.detail?.stockAnalysis?.analystViews ?? [];
    if (analystViews.length === 0) {
      setActiveAnalystTitle("");
      return;
    }
    setActiveAnalystTitle((current) =>
      analystViews.some((item) => item.title === current) ? current : analystViews[0].title,
    );
  }, [snapshot?.detail?.stockAnalysis?.analystViews]);

  useEffect(() => {
    const detail = snapshot?.detail;
    const detailSymbol = detail?.symbol?.trim() ?? "";
    if (!detailSymbol || analysisControlsSymbolRef.current === detailSymbol || analysisControlsDirtyRef.current) {
      return;
    }
    const selectedAnalysts = (detail?.stockAnalysis?.analysts ?? []).filter((item) => item.selected).map((item) => item.value);
    setSelectedStockAnalysisAnalysts(selectedAnalysts.length > 0 ? selectedAnalysts : STOCK_ANALYSIS_ANALYSTS);
    setStockAnalysisCycle(detail?.stockAnalysis?.cycle || "1y");
    analysisControlsSymbolRef.current = detailSymbol;
  }, [snapshot?.detail]);

  useEffect(() => {
    analysisControlsSymbolRef.current = "";
    analysisControlsDirtyRef.current = false;
    setSelectedStockAnalysisAnalysts(STOCK_ANALYSIS_ANALYSTS);
    setStockAnalysisCycle("1y");
  }, [normalizedSymbol]);

  const savePosition = async () => {
    if (!normalizedSymbol) return;
    const detailForm = snapshot?.detail?.positionForm;
    try {
      const response = await client.patchPortfolioPosition<PortfolioSnapshot>(normalizedSymbol, {
        quantity: form.quantity || detailForm?.quantity || "",
        costPrice: form.costPrice || detailForm?.costPrice || "",
        takeProfit: form.takeProfit || detailForm?.takeProfit || "",
        stopLoss: form.stopLoss || detailForm?.stopLoss || "",
      });
      writeCachedPortfolioSnapshot(normalizedSymbol, response);
      setSnapshot(response);
      setStatus("ready");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  const pollStockAnalysisTask = async (taskId: string): Promise<TaskJob | null> => {
    for (let attempt = 0; attempt < STOCK_ANALYSIS_POLL_LIMIT; attempt += 1) {
      const latest = await client.getTaskStatus<TaskJob>(taskId);
      setStockAnalysisJob(latest);
      setStockAnalysisStatus(latest.message || `股票分析任务状态：${latest.status}`);
      if (latest.status === "completed" || latest.status === "failed") {
        return latest;
      }
      await sleep(STOCK_ANALYSIS_POLL_INTERVAL_MS);
    }
    return null;
  };

  const toggleStockAnalysisAnalyst = (value: string) => {
    analysisControlsDirtyRef.current = true;
    setSelectedStockAnalysisAnalysts((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const updateStockAnalysis = async () => {
    if (!normalizedSymbol || isStockAnalysisUpdating) return;
    if (selectedStockAnalysisAnalysts.length === 0) {
      setStockAnalysisStatus("请至少选择一个分析师。");
      return;
    }
    setIsStockAnalysisUpdating(true);
    setStockAnalysisStatus(`已提交 ${normalizedSymbol} 分析更新。`);
    setStockAnalysisJob(null);
    try {
      const response = await client.runPageAction<WorkbenchSnapshot>("workbench", "analysis", {
        stockCode: normalizedSymbol,
        analysts: selectedStockAnalysisAnalysts,
        cycle: stockAnalysisCycle,
        mode: "单个分析",
      });
      const initialJob = response.analysisJob ?? null;
      const taskId = response.taskId || initialJob?.id || "";
      if (initialJob) {
        setStockAnalysisJob(initialJob);
        setStockAnalysisStatus(initialJob.message || "股票分析任务已提交。");
      }
      let finalJob = initialJob;
      if ((initialJob?.status === "queued" || initialJob?.status === "running") && taskId) {
        finalJob = await pollStockAnalysisTask(taskId);
      }
      const completedAnalysis = taskResultForSymbol(finalJob, normalizedSymbol)
        ?? (normalizeSymbolForCompare(response.analysis?.symbol) === normalizeSymbolForCompare(normalizedSymbol) ? response.analysis : null);
      const refreshed = await refreshRealtimeData({ silent: true });
      if (!refreshed) {
        await load({ showLoading: false });
      }
      if (completedAnalysis) {
        setSnapshot((current) => {
          const updated = applyStockAnalysis(current, completedAnalysis);
          writeCachedPortfolioSnapshot(normalizedSymbol, updated);
          return updated;
        });
      }
      setStockAnalysisStatus(finalJob?.status === "failed" ? "分析任务失败，已刷新当前可用详情。" : "分析已更新，实时行情、K线和技术指标已刷新。");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStockAnalysisStatus(`股票分析更新失败：${message}`);
    } finally {
      setIsStockAnalysisUpdating(false);
    }
  };

  if (status === "loading" && !snapshot) {
    return <PageLoadingState title="持仓详情加载中" description="正在读取本地缓存的股票详情。" />;
  }

  if (status === "error" && !snapshot) {
    return <PageErrorState title="持仓详情加载失败" description={error ?? "无法加载持仓详情。"} actionLabel="重试" onAction={() => void load()} />;
  }

  if (!snapshot?.detail) {
    return <PageEmptyState title="持仓详情为空" description="当前股票没有可展示内容。" actionLabel="返回上一页" onAction={() => navigate(-1)} />;
  }

  const detail = snapshot.detail;
  const titleName = detail.stockName && detail.stockName !== detail.symbol ? `${detail.symbol} ${detail.stockName}` : detail.symbol;
  const marketSnapshot = detail.marketSnapshot;
  const marketUpdatedAt = marketSnapshot?.updatedAt ?? detail.decision.updatedAt ?? snapshot.updatedAt ?? "--";
  const latestPrice = marketSnapshot?.latestPrice ?? "--";
  const latestSignal = marketSnapshot?.latestSignal ?? detail.decision.rating ?? "--";
  const headerDescription = `板块：${detail.sector || "--"} · 现价：${latestPrice} · 更新时间：${marketUpdatedAt}`;
  const klinePoints = detail.kline ?? [];
  const analystViews = detail.stockAnalysis?.analystViews ?? [];
  const activeAnalystView = analystViews.find((item) => item.title === activeAnalystTitle) ?? analystViews[0] ?? null;
  const stockAnalysisInsights = (detail.stockAnalysis?.insights ?? []).filter((insight) => !isMergedStockInsight(insight.title));
  const i18nIndicatorText = (value?: string) => {
    if (!value || value === "--") return "--";
    return t(value);
  };
  const technicalView = buildTechnicalView(detail.indicators, latestPrice);
  const portfolioDecision = snapshot.portfolioDecision;
  const positionForm = detail.positionForm;
  const hasRegisteredPosition = isMeaningfulPositionValue(positionForm?.quantity);
  const decisionAction = singleStockActionLabel(latestSignal, detail.decision.rating, hasRegisteredPosition);
  const portfolioAdvice = portfolioDecision?.action ? `${portfolioDecision.action} · ${portfolioDecision.targetExposurePct ?? "--"}` : "--";
  const shouldShowSignalPill = latestSignal !== "--";
  const tradingRiskLine = `止盈 ${positionForm?.takeProfit || "--"} · 止损 ${positionForm?.stopLoss || "--"}`;

  return (
    <div className="portfolio-detail-page">
      <PageHeader
        eyebrow="Portfolio detail"
        title={titleName}
        description={headerDescription}
        actions={(
          <>
            <button className="button button--secondary" type="button" onClick={() => navigate(-1)}>
              返回上一页
            </button>
            <button className="button button--secondary" type="button" onClick={() => void refreshRealtimeData()} disabled={isDetailRefreshing}>
              {isDetailRefreshing ? "更新详情中..." : "更新详情"}
            </button>
            <button className="button button--secondary" type="button" onClick={() => void updateStockAnalysis()} disabled={isStockAnalysisUpdating || selectedStockAnalysisAnalysts.length === 0}>
              {isStockAnalysisUpdating ? "更新中..." : "更新分析"}
            </button>
            <button className="button button--secondary" type="button" onClick={() => void savePosition()}>
              更新持仓
            </button>
          </>
        )}
      />

      <div className="portfolio-detail-stack">
        <div className="portfolio-detail-main-grid">
          <WorkbenchCard className="portfolio-decision-panel portfolio-decision-plan-card">
            <div className="portfolio-card-heading">
              <div>
                <div className="portfolio-card-heading__eyebrow">决策与执行</div>
                <h2 className="section-card__title">决策计划</h2>
              </div>
              {shouldShowSignalPill ? <span className={signalPillClassName(latestSignal)}>{latestSignal}</span> : null}
            </div>
            <div className="portfolio-decision-action">{decisionAction}</div>
            <div className="portfolio-decision-metrics portfolio-decision-metrics--merged">
              <div className="mini-metric">
                <div className="mini-metric__label">现价</div>
                <div className="mini-metric__value">{latestPrice}</div>
              </div>
              <div className="mini-metric">
                <div className="mini-metric__label">更新时间</div>
                <div className="mini-metric__value">{marketUpdatedAt}</div>
              </div>
              <div className="mini-metric">
                <div className="mini-metric__label">组合建议</div>
                <div className="mini-metric__value">{portfolioAdvice}</div>
              </div>
              <div className="mini-metric">
                <div className="mini-metric__label">当前仓位</div>
                <div className="mini-metric__value">{positionForm?.quantity || "--"}</div>
              </div>
              <div className="mini-metric">
                <div className="mini-metric__label">成本</div>
                <div className="mini-metric__value">{positionForm?.costPrice || "--"}</div>
              </div>
              <div className="mini-metric">
                <div className="mini-metric__label">风控线</div>
                <div className="mini-metric__value">{tradingRiskLine}</div>
              </div>
            </div>
            <h3 className="portfolio-subsection-title">持仓信息</h3>
            <div className="portfolio-position-form portfolio-position-form--compact">
              <label className="field">
                <span className="field__label">持仓数量</span>
                <input className="input" value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} />
              </label>
              <label className="field">
                <span className="field__label">成本价格</span>
                <input className="input" value={form.costPrice} onChange={(event) => setForm((prev) => ({ ...prev, costPrice: event.target.value }))} />
              </label>
              <label className="field">
                <span className="field__label">止盈价格</span>
                <input className="input" value={form.takeProfit} onChange={(event) => setForm((prev) => ({ ...prev, takeProfit: event.target.value }))} />
              </label>
              <label className="field">
                <span className="field__label">止损价格</span>
                <input className="input" value={form.stopLoss} onChange={(event) => setForm((prev) => ({ ...prev, stopLoss: event.target.value }))} />
              </label>
            </div>
          </WorkbenchCard>

          <WorkbenchCard className="portfolio-key-indicators-card">
            <div className="portfolio-card-heading">
              <div>
                <div className="portfolio-card-heading__eyebrow">指标摘要</div>
                <h2 className="section-card__title">关键技术指标</h2>
              </div>
            </div>
            {(detail.indicators ?? []).length > 0 ? (
              <div className="portfolio-technical-panel">
                <div className="portfolio-technical-status-row" aria-label="技术状态摘要">
                  {technicalView.status.map((item) => (
                    <div className={statusToneClass(item.tone)} key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>

                <section className="portfolio-technical-section portfolio-technical-section--price">
                  <div className="portfolio-technical-section__head">
                    <strong>价格位置</strong>
                    <span>{technicalView.comments.trend}</span>
                  </div>
                  {technicalView.axis.length > 0 ? (
                    <>
                      <div className="portfolio-price-axis" aria-label="价格位置轴">
                        <div className="portfolio-price-axis__track" />
                        {technicalView.axis.map((item) => (
                          <span
                            className={`portfolio-price-axis__marker portfolio-price-axis__marker--${item.key}`}
                            key={item.key}
                            style={{ left: `${item.pct}%` }}
                            title={`${item.label} ${metricValue(item.metric)}`}
                          />
                        ))}
                      </div>
                      <div className="portfolio-price-axis__legend">
                        {technicalView.axis.map((item) => (
                          <div className={item.key === "price" ? "is-current" : ""} key={`${item.key}-legend`}>
                            <span>{item.label}</span>
                            <strong>{metricValue(item.metric)}</strong>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="empty-note">价格位置数据不足。</div>
                  )}
                </section>

                <div className="portfolio-technical-section-grid">
                  <section className="portfolio-technical-section">
                    <div className="portfolio-technical-section__head">
                      <strong>趋势结构</strong>
                      <span>均线排列与压力支撑</span>
                    </div>
                    <div className="portfolio-technical-metric-row">
                      {[technicalView.metrics.ma5, technicalView.metrics.ma10, technicalView.metrics.ma20, technicalView.metrics.ma60].map((metric, metricIndex) => (
                        <div className="portfolio-technical-metric" key={`trend-${metricIndex}-${metric?.label ?? "empty"}`}>
                          <span>{i18nIndicatorText(metric?.label)}</span>
                          <strong>{metricValue(metric)}</strong>
                        </div>
                      ))}
                    </div>
                    <p>{technicalView.comments.trend}</p>
                  </section>

                  <section className="portfolio-technical-section">
                    <div className="portfolio-technical-section__head">
                      <strong>动量指标</strong>
                      <span>MACD / RSI / KDJ</span>
                    </div>
                    <div className="portfolio-technical-metric-row">
                      {[technicalView.metrics.macd, technicalView.metrics.signalLine, technicalView.metrics.macdBar, technicalView.metrics.rsi, technicalView.metrics.kValue, technicalView.metrics.dValue].map((metric, metricIndex) => (
                        <div className="portfolio-technical-metric" key={`momentum-${metricIndex}-${metric?.label ?? "empty"}`}>
                          <span>{i18nIndicatorText(metric?.label)}</span>
                          <strong>{metricValue(metric)}</strong>
                        </div>
                      ))}
                    </div>
                    <p>{technicalView.comments.momentum}</p>
                  </section>

                  <section className="portfolio-technical-section">
                    <div className="portfolio-technical-section__head">
                      <strong>量能与波动</strong>
                      <span>成交参与度和布林带</span>
                    </div>
                    <div className="portfolio-technical-metric-row">
                      {[technicalView.metrics.volume, technicalView.metrics.volumeMa5, technicalView.metrics.volumeRatio, technicalView.metrics.bollLower, technicalView.metrics.bollMid, technicalView.metrics.bollUpper].map((metric, metricIndex) => (
                        <div className="portfolio-technical-metric" key={`volume-${metricIndex}-${metric?.label ?? "empty"}`}>
                          <span>{i18nIndicatorText(metric?.label)}</span>
                          <strong>{metricValue(metric)}</strong>
                        </div>
                      ))}
                    </div>
                    <p>{technicalView.comments.volume}</p>
                  </section>
                </div>
              </div>
            ) : (
              <div className="empty-note">暂无关键技术指标。</div>
            )}
            <div className="summary-item__meta">行情更新时间：{marketUpdatedAt} · 信号：{latestSignal}</div>
          </WorkbenchCard>
        </div>

        <WorkbenchCard className="portfolio-kline-card portfolio-kline-card--full">
          <div className="portfolio-card-heading">
            <div>
              <div className="portfolio-card-heading__eyebrow">行情图表</div>
              <h2 className="section-card__title">K线走势</h2>
            </div>
            <span className="badge badge--neutral">{klinePoints.length > 0 ? `${klinePoints.length} 个点` : "暂无数据"}</span>
          </div>
          <div className="summary-item portfolio-kline-panel">
            {klinePoints.length >= 2 ? (
              <Sparkline points={klinePoints} height={520} />
            ) : (
              <div className="empty-note portfolio-kline-empty">
                暂无K线数据，点击“更新详情”拉取最新行情、K线和技术指标。
              </div>
            )}
          </div>
        </WorkbenchCard>

        <WorkbenchCard className="portfolio-stock-analysis-card">
          <div className="portfolio-card-heading">
            <div>
              <div className="portfolio-card-heading__eyebrow">分析结论</div>
              <h2 className="section-card__title">当前股票分析</h2>
            </div>
            {detail.stockAnalysis?.generatedAt ? <span className="badge badge--neutral">分析日期：{detail.stockAnalysis.generatedAt}</span> : null}
          </div>
          <div className="summary-item portfolio-stock-analysis-settings">
            <div className="portfolio-stock-analysis-settings__head">
              <div>
                <div className="summary-item__title">分析设置</div>
                <div className="summary-item__body">选择本次详情页更新分析使用的分析师。</div>
              </div>
              <label className="field portfolio-stock-analysis-cycle">
                <span className="field__label">分析周期</span>
                <select
                  className="input"
                  aria-label="分析周期"
                  value={stockAnalysisCycle}
                  onChange={(event) => {
                    analysisControlsDirtyRef.current = true;
                    setStockAnalysisCycle(event.target.value);
                  }}
                >
                  {STOCK_ANALYSIS_CYCLES.map((cycle) => (
                    <option value={cycle} key={cycle}>
                      {cycle}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="chip-row" style={{ marginTop: 10 }}>
              {STOCK_ANALYSIS_OPTIONS.map((option) => (
                <button
                  className={`chip${selectedStockAnalysisAnalysts.includes(option.value) ? " chip--active" : ""}`}
                  type="button"
                  key={option.value}
                  aria-label={`分析设置：${option.label}`}
                  aria-pressed={selectedStockAnalysisAnalysts.includes(option.value)}
                  onClick={() => toggleStockAnalysisAnalyst(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {detail.stockAnalysis ? (
            <>
              <div className="portfolio-stock-analysis-grid">
                <div className="summary-item summary-item--accent portfolio-final-decision">
                  <div className="summary-item__title">最终建议</div>
                  <MarkdownBlock className="summary-item__body markdown-body content-scroll" content={buildFinalDecisionContent(detail.stockAnalysis)} />
                </div>
                {stockAnalysisInsights.map((insight) => (
                  <div className="summary-item" key={`${insight.title}-${insight.body}`}>
                    <div className="summary-item__title">{insight.title}</div>
                    <MarkdownBlock className="summary-item__body markdown-body content-scroll" content={insight.body} />
                  </div>
                ))}
              </div>
              <details className="portfolio-disclosure portfolio-analysis-raw" open>
                <summary>完整分析原文</summary>
                <div className="summary-item__body">
                  <strong>{detail.stockAnalysis.summaryTitle}</strong>
                </div>
                <MarkdownBlock className="summary-item__body markdown-body content-scroll" content={detail.stockAnalysis.summaryBody} />
              </details>
              {(detail.stockAnalysis.analystViews ?? []).length > 0 ? (
                <div className="portfolio-analyst-views">
                  <div className="portfolio-analyst-views__head">
                    <div>
                      <div className="summary-item__title">分析师观点</div>
                      <div className="summary-item__body">切换查看各分析师的独立结论。</div>
                    </div>
                    <span>{analystViews.length} 个观点</span>
                  </div>
                  {activeAnalystView ? (
                    <div className="analyst-layout portfolio-analyst-layout">
                      <div className="analyst-layout__nav">
                        {analystViews.map((view, index) => (
                          <button
                            key={`${view.title}-${index}`}
                            type="button"
                            className={`analyst-tab${view.title === activeAnalystView.title ? " analyst-tab--active" : ""}`}
                            onClick={() => setActiveAnalystTitle(view.title)}
                          >
                            {view.title}
                          </button>
                        ))}
                      </div>
                      <div className="analyst-layout__content">
                        <div className="summary-item__title">{activeAnalystView.title}</div>
                        <MarkdownBlock className="summary-item__body markdown-body content-scroll" content={activeAnalystView.body} />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="summary-item__body">暂无股票分析结果，点击“更新分析”生成最新分析。</div>
          )}
          {stockAnalysisStatus ? (
            <div className="summary-item__meta" style={{ marginTop: 8 }}>
              {stockAnalysisStatus}
              {stockAnalysisJob?.progress !== undefined ? `（${stockAnalysisJob.progress}%）` : ""}
            </div>
          ) : null}
        </WorkbenchCard>

        <WorkbenchCard className="portfolio-pending-signals-card">
          <h2 className="section-card__title" style={{ fontSize: "1.2rem" }}>
            待执行信号
          </h2>
          <div className="table-shell">
            <table className="table table--auto">
              <thead>
                <tr>
                  {(detail.pendingSignals.columns ?? []).map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(detail.pendingSignals.rows ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={(detail.pendingSignals.columns?.length ?? 0) || 1} className="table__empty">
                      {detail.pendingSignals.emptyLabel ?? "暂无待执行信号"}
                    </td>
                  </tr>
                ) : (
                  detail.pendingSignals.rows.map((row) => (
                    <tr key={row.id}>
                      {row.cells.map((cell, index) => (
                        <td key={`${row.id}-${index}`}>{cell}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </WorkbenchCard>
      </div>
    </div>
  );
}
