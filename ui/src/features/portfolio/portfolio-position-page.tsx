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
  const i18nIndicatorText = (value?: string) => {
    if (!value || value === "--") return "--";
    return t(value);
  };
  const topIndicators = pickTopIndicators(detail.indicators, 8);
  const topIndicatorKeys = new Set(topIndicators.map((indicator) => normalizeIndicatorKey(indicator.label)));
  const remainingIndicators = (detail.indicators ?? []).filter((indicator) => !topIndicatorKeys.has(normalizeIndicatorKey(indicator.label)));
  const indicatorPairs: Array<[typeof detail.indicators[number] | null, typeof detail.indicators[number] | null]> = [];
  for (let index = 0; index < remainingIndicators.length; index += 2) {
    indicatorPairs.push([remainingIndicators[index] ?? null, remainingIndicators[index + 1] ?? null]);
  }
  const portfolioDecision = snapshot.portfolioDecision;
  const decisionAction = portfolioDecision?.action || detail.decision.rating || latestSignal || "--";
  const shouldShowSignalPill = latestSignal !== "--";
  const positionForm = detail.positionForm;
  const hasRegisteredPosition = isMeaningfulPositionValue(positionForm?.quantity);
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
                <div className="mini-metric__label">目标仓位</div>
                <div className="mini-metric__value">{portfolioDecision?.targetExposurePct ?? "--"}</div>
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
            {(portfolioDecision?.reasons ?? []).length > 0 ? (
              <ul className="insight-list portfolio-decision-reasons">
                {portfolioDecision?.reasons?.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            ) : null}
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
            {topIndicators.length > 0 ? (
              <div className="portfolio-indicator-chip-grid portfolio-indicator-chip-grid--summary">
                {topIndicators.map((indicator) => (
                  <div className="portfolio-indicator-chip" key={`top-${indicator.label}-${indicator.value}`}>
                    <span>{i18nIndicatorText(indicator.label)}</span>
                    <strong>{indicator.value}</strong>
                    <small>{i18nIndicatorText(indicator.hint)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-note">暂无关键技术指标。</div>
            )}
            <details className="portfolio-disclosure">
              <summary>更多指标明细</summary>
              {indicatorPairs.length === 0 ? (
                <div className="summary-item__body">暂无更多技术指标</div>
              ) : (
                <div className="table-shell">
                  <table className="table table--auto portfolio-indicator-table">
                    <thead>
                      <tr>
                        <th>指标</th>
                        <th>数值</th>
                        <th>说明</th>
                        <th>指标</th>
                        <th>数值</th>
                        <th>说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicatorPairs.map(([left, right], pairIndex) => (
                        <tr key={`indicator-pair-${pairIndex}`}>
                          <td className="table__cell-strong">{i18nIndicatorText(left?.label)}</td>
                          <td>{left?.value ?? "--"}</td>
                          <td>{i18nIndicatorText(left?.hint)}</td>
                          <td className="table__cell-strong">{i18nIndicatorText(right?.label)}</td>
                          <td>{right?.value ?? "--"}</td>
                          <td>{i18nIndicatorText(right?.hint)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
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
            <div className="summary-item__title">分析设置</div>
            <div className="summary-item__body">选择本次详情页更新分析使用的分析师和数据周期。</div>
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
          {detail.stockAnalysis ? (
            <>
              <div className="portfolio-stock-analysis-grid">
                <div className="summary-item summary-item--accent">
                  <div className="summary-item__title">最终建议</div>
                  <MarkdownBlock className="summary-item__body markdown-body content-scroll" content={detail.stockAnalysis.finalDecisionText || detail.stockAnalysis.decision || "暂无最终建议"} />
                </div>
                {(detail.stockAnalysis.insights ?? []).map((insight) => (
                  <div className="summary-item" key={`${insight.title}-${insight.body}`}>
                    <div className="summary-item__title">{insight.title}</div>
                    <MarkdownBlock className="summary-item__body markdown-body content-scroll" content={insight.body} />
                  </div>
                ))}
              </div>
              <details className="portfolio-disclosure portfolio-analysis-raw">
                <summary>完整分析原文</summary>
                <div className="summary-item__body">
                  <strong>{detail.stockAnalysis.summaryTitle}</strong>
                </div>
                <MarkdownBlock className="summary-item__body markdown-body content-scroll" content={detail.stockAnalysis.summaryBody} />
              </details>
              {(detail.stockAnalysis.analystViews ?? []).length > 0 ? (
                <>
                  <div className="summary-item portfolio-analyst-views">
                    <div className="summary-item__title">分析师观点</div>
                    <div className="summary-item__body">按工作台同款视图切换不同分析师结论。</div>
                  </div>
                  {activeAnalystView ? (
                    <div className="analyst-layout portfolio-analyst-layout" style={{ marginTop: "12px" }}>
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
                </>
              ) : null}
              {(detail.stockAnalysis.indicators ?? []).length > 0 ? (
                <div className="mini-metric-grid portfolio-stock-analysis-metrics">
                  {detail.stockAnalysis.indicators.map((indicator) => (
                    <div className="mini-metric" key={`${indicator.label}-${indicator.value}`}>
                      <div className="mini-metric__label">{indicator.label}</div>
                      <div className="mini-metric__value">{indicator.value}</div>
                    </div>
                  ))}
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
