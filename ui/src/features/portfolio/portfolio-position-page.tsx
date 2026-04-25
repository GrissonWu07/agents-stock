import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ApiClient } from "../../lib/api-client";
import type { PortfolioSnapshot, TaskJob, WorkbenchAnalysisResult, WorkbenchSnapshot } from "../../lib/page-models";
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

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const normalizeSymbolForCompare = (value?: string) => (value ?? "").trim().toUpperCase();

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
  return stockAnalysisTextLength(current) >= stockAnalysisTextLength(incoming) ? current : incoming;
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
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
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

  const load = useCallback(async (options?: { showLoading?: boolean }) => {
    if (!normalizedSymbol) return;
    if (options?.showLoading !== false) {
      setStatus("loading");
    }
    setError(null);
    try {
      const response = await client.getPortfolioPosition<PortfolioSnapshot>(normalizedSymbol);
      setSnapshot((current) => mergePortfolioSnapshot(current, response));
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
      setSnapshot((current) => mergePortfolioSnapshot(current, response));
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
        setSnapshot((current) => applyStockAnalysis(current, completedAnalysis));
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
  const headerDescription = `板块：${detail.sector || "--"} · 最新价：${detail.marketSnapshot?.latestPrice ?? "--"} · 来源：${detail.marketSnapshot?.source ?? "--"}`;
  const klinePoints = detail.kline ?? [];
  const analystViews = detail.stockAnalysis?.analystViews ?? [];
  const activeAnalystView = analystViews.find((item) => item.title === activeAnalystTitle) ?? analystViews[0] ?? null;
  const i18nIndicatorText = (value?: string) => {
    if (!value || value === "--") return "--";
    return t(value);
  };
  const indicatorPairs: Array<[typeof detail.indicators[number] | null, typeof detail.indicators[number] | null]> = [];
  for (let index = 0; index < (detail.indicators?.length ?? 0); index += 2) {
    indicatorPairs.push([detail.indicators[index] ?? null, detail.indicators[index + 1] ?? null]);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Portfolio detail"
        title={titleName}
        description={headerDescription}
      />
      <div className="toolbar toolbar--compact" style={{ marginBottom: 12 }}>
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
      </div>
      <div className="stack">
        <WorkbenchCard>
          <div className="summary-item portfolio-indicator-panel" style={{ marginBottom: 12 }}>
            <div className="summary-item__title">技术指标</div>
            {indicatorPairs.length === 0 ? (
              <div className="summary-item__body">暂无技术指标</div>
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
            <div className="summary-item__meta" style={{ marginTop: 8 }}>
              行情更新时间：{detail.marketSnapshot?.updatedAt ?? "--"} · 信号：{detail.marketSnapshot?.latestSignal ?? "--"}
            </div>
          </div>

          <h2 className="section-card__title" style={{ fontSize: "1.2rem" }}>
            K线走势
          </h2>
          <div className="summary-item portfolio-kline-panel" style={{ marginBottom: 12 }}>
            {klinePoints.length >= 2 ? (
              <Sparkline points={klinePoints} height={340} />
            ) : (
              <div className="empty-note" style={{ minHeight: 220 }}>
                暂无K线数据，点击“更新详情”拉取最新行情、K线和技术指标。
              </div>
            )}
          </div>

          <h2 className="section-card__title" style={{ fontSize: "1.2rem" }}>
            持仓信息
          </h2>
          <div className="portfolio-position-form">
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
          <div className="summary-item" style={{ marginTop: 10 }}>
            <div className="summary-item__title">实时分析结论</div>
            <div className="summary-item__body">{detail.decision.summary ?? "暂无分析结论"}</div>
          </div>
          <div className="summary-item portfolio-stock-analysis-card" style={{ marginTop: 10 }}>
            <div className="summary-item__title">当前股票分析</div>
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
                <div className="summary-item__body">
                  <strong>{detail.stockAnalysis.summaryTitle}</strong>
                </div>
                <MarkdownBlock className="summary-item__body markdown-body content-scroll" content={detail.stockAnalysis.summaryBody} />
                {detail.stockAnalysis.generatedAt ? (
                  <div className="summary-item__meta">分析日期：{detail.stockAnalysis.generatedAt}</div>
                ) : null}
                <div className="portfolio-stock-analysis-grid">
                  <div className="summary-item">
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
          </div>

          <div className="card-divider" />
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
