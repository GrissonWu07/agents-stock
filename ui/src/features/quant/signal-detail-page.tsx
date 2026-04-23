import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/ui/page-header";
import { WorkbenchCard } from "../../components/ui/workbench-card";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../../components/ui/page-state";
import { t } from "../../lib/i18n";
import { useCompactLayout } from "../../lib/use-compact-layout";
import { localizeDecisionCode, localizeStrategyMode } from "./quant-decision-localizer";

type VoteRow = {
  factor: string;
  signal: string;
  score: string;
  reason: string;
};

type IndicatorRow = {
  name: string;
  value: string;
  source: string;
  note?: string;
};

type ThresholdRow = {
  name: string;
  value: string;
};

type ParameterDetailRow = {
  name: string;
  value: string;
  source: string;
  derivation: string;
};

type VoteDetailRow = {
  track: string;
  voter: string;
  signal: string;
  score: string;
  weight: string;
  contribution: string;
  reason: string;
  calculation: string;
};

type VoteOverview = {
  voterCount: number;
  technicalVoterCount: number;
  contextVoterCount: number;
  formula: string;
  technicalAggregation: string;
  contextAggregation: string;
  rows: VoteDetailRow[];
};

type AiMonitorValueRow = {
  label: string;
  value: string;
  note?: string;
};

type AiMonitorHistoryRow = {
  id: string;
  decisionTime: string;
  action: string;
  confidence: string;
  riskLevel: string;
  positionSizePct: string;
  stopLossPct: string;
  takeProfitPct: string;
  tradingSession: string;
  executed: boolean;
  executionResult: string;
  reasoning: string;
};

type AiMonitorTradeRow = {
  id: string;
  tradeTime: string;
  tradeType: string;
  quantity: string;
  price: string;
  amount: string;
  commission: string;
  tax: string;
  profitLoss: string;
  orderStatus: string;
};

type AiMonitorPayload = {
  available: boolean;
  stockCode: string;
  matchedMode: string;
  message: string;
  decision: {
    id: string;
    decisionTime: string;
    action: string;
    confidence: string;
    riskLevel: string;
    positionSizePct: string;
    stopLossPct: string;
    takeProfitPct: string;
    tradingSession: string;
    executed: boolean;
    executionResult: string;
    reasoning: string;
  };
  keyLevels: AiMonitorValueRow[];
  marketData: AiMonitorValueRow[];
  accountData: AiMonitorValueRow[];
  history: AiMonitorHistoryRow[];
  trades: AiMonitorTradeRow[];
};

type SignalDetailPayload = {
  updatedAt: string;
  analysis: string;
  reasoning: string;
  explanation?: {
    summary?: string;
    basis?: string[];
    techEvidence?: string[];
    contextEvidence?: string[];
    thresholdEvidence?: string[];
    contextScoreExplain?: {
      formula?: string;
      confidenceFormula?: string;
      componentBreakdown?: string[];
      componentSum?: number;
      finalScore?: string;
    };
    original?: {
      analysis?: string;
      reasoning?: string;
    };
  };
  decision: {
    id: string;
    source: string;
    stockCode: string;
    stockName: string;
    action: string;
    status: string;
    decisionType: string;
    confidence: string;
    positionSizePct: string;
    techScore: string;
    contextScore: string;
    checkpointAt: string;
    createdAt: string;
    analysisTimeframe: string;
    strategyMode: string;
    marketRegime: string;
    fundamentalQuality: string;
    riskStyle: string;
    autoInferredRiskStyle: string;
    techSignal: string;
    contextSignal: string;
    resonanceType: string;
    ruleHit: string;
    finalAction: string;
    finalReason: string;
    positionRatio: string;
  };
  techVotes: VoteRow[];
  contextVotes: VoteRow[];
  technicalIndicators: IndicatorRow[];
  effectiveThresholds: ThresholdRow[];
  voteOverview?: VoteOverview;
  parameterDetails?: ParameterDetailRow[];
  aiMonitor?: AiMonitorPayload;
};

const emptyAiMonitor: AiMonitorPayload = {
  available: false,
  stockCode: "",
  matchedMode: "none",
  message: "",
  decision: {
    id: "",
    decisionTime: "--",
    action: "HOLD",
    confidence: "--",
    riskLevel: "--",
    positionSizePct: "--",
    stopLossPct: "--",
    takeProfitPct: "--",
    tradingSession: "--",
    executed: false,
    executionResult: "--",
    reasoning: "--",
  },
  keyLevels: [],
  marketData: [],
  accountData: [],
  history: [],
  trades: [],
};

const emptyDetail: SignalDetailPayload = {
  updatedAt: "",
  analysis: "",
  reasoning: "",
  explanation: {
    summary: "",
    basis: [],
    techEvidence: [],
    contextEvidence: [],
    thresholdEvidence: [],
    contextScoreExplain: {
      formula: "",
      confidenceFormula: "",
      componentBreakdown: [],
      componentSum: 0,
      finalScore: "0",
    },
    original: { analysis: "", reasoning: "" },
  },
  decision: {
    id: "",
    source: "auto",
    stockCode: "",
    stockName: "",
    action: "HOLD",
    status: "observed",
    decisionType: "auto",
    confidence: "0",
    positionSizePct: "0",
    techScore: "0",
    contextScore: "0",
    checkpointAt: "--",
    createdAt: "--",
    analysisTimeframe: "--",
    strategyMode: "--",
    marketRegime: "--",
    fundamentalQuality: "--",
    riskStyle: "--",
    autoInferredRiskStyle: "--",
    techSignal: "--",
    contextSignal: "--",
    resonanceType: "--",
    ruleHit: "--",
    finalAction: "HOLD",
    finalReason: "--",
    positionRatio: "0",
  },
  techVotes: [],
  contextVotes: [],
  technicalIndicators: [],
  effectiveThresholds: [],
  voteOverview: {
    voterCount: 0,
    technicalVoterCount: 0,
    contextVoterCount: 0,
    formula: "",
    technicalAggregation: "",
    contextAggregation: "",
    rows: [],
  },
  parameterDetails: [],
  aiMonitor: emptyAiMonitor,
};

function tableRowEmpty(colSpan: number, text: string) {
  return (
    <tr>
      <td className="table__empty" colSpan={colSpan}>
        {text}
      </td>
    </tr>
  );
}

type CompactDataRow = {
  key: string;
  cells: ReactNode[];
};

function CompactDataTable({
  isCompactLayout,
  headers,
  rows,
  coreIndexes,
  emptyText,
}: {
  isCompactLayout: boolean;
  headers: string[];
  rows: CompactDataRow[];
  coreIndexes: number[];
  emptyText: string;
}) {
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const validCoreIndexes = coreIndexes.filter(
    (index, position, all) => Number.isInteger(index) && index >= 0 && index < headers.length && all.indexOf(index) === position,
  );
  const finalCoreIndexes = validCoreIndexes.length > 0 ? validCoreIndexes : [0];
  const detailIndexes = headers.map((_, index) => index).filter((index) => !finalCoreIndexes.includes(index));

  if (!isCompactLayout) {
    return (
      <div className="table-shell">
        <table className="table table--auto">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? tableRowEmpty(headers.length, emptyText) : rows.map((row) => <tr key={row.key}>{row.cells.map((cell, idx) => <td key={`${row.key}-${idx}`}>{cell}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    );
  }

  const toggleExpand = (rowKey: string) => {
    setExpandedRows((current) => (current.includes(rowKey) ? current.filter((item) => item !== rowKey) : [...current, rowKey]));
  };

  return (
    <div className="table-shell table-shell--compact">
      <table className="table table--auto">
        <thead>
          <tr>
            {finalCoreIndexes.map((index) => (
              <th key={headers[index]}>{headers[index]}</th>
            ))}
            {detailIndexes.length > 0 ? <th className="table__actions-head">{t("Detail")}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            tableRowEmpty(finalCoreIndexes.length + (detailIndexes.length > 0 ? 1 : 0), emptyText)
          ) : (
            rows.flatMap((row) => {
              const expanded = expandedRows.includes(row.key);
              const mainRow = (
                <tr key={`${row.key}-main`} className="table__compact-main-row">
                  {finalCoreIndexes.map((index, idx) => (
                    <td key={`${row.key}-core-${index}`} className={idx === 0 ? "table__cell-strong" : undefined}>
                      {row.cells[index]}
                    </td>
                  ))}
                  {detailIndexes.length > 0 ? (
                    <td className="table__compact-control-cell">
                      <button className="button button--secondary button--small table__expand-button" type="button" aria-expanded={expanded} onClick={() => toggleExpand(row.key)}>
                        {expanded ? t("Collapse") : t("Expand")}
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
              if (!expanded || detailIndexes.length === 0) {
                return [mainRow];
              }
              const detailRow = (
                <tr key={`${row.key}-detail`} className="table__compact-detail-row">
                  <td className="table__compact-detail-cell" colSpan={finalCoreIndexes.length + 1}>
                    <div className="compact-detail-grid">
                      {detailIndexes.map((index) => (
                        <div className="compact-detail-item" key={`${row.key}-detail-${index}`}>
                          <div className="compact-detail-item__label">{headers[index]}</div>
                          <div className="compact-detail-item__value">{row.cells[index]}</div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              );
              return [mainRow, detailRow];
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function _safeValue(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }
  return "--";
}

const REQUIRED_MARKET_TECHNICAL_INDICATORS = [
  "当前价",
  "涨跌幅",
  "开盘价",
  "最高价",
  "最低价",
  "成交量(手)",
  "成交额(万)",
  "换手率",
  "量比",
  "趋势",
  "DIF",
  "DEA",
  "RSI6",
  "RSI12",
  "RSI24",
  "KDJ-K",
  "KDJ-D",
  "KDJ-J",
];

function _normalizeIndicatorName(name: string): string {
  const raw = String(name || "").trim();
  if (!raw) {
    return "";
  }
  const text = raw.replace(/\s+/g, "").replace(/（/g, "(").replace(/）/g, ")");
  const lower = text.toLowerCase();
  if (text === "当前价" || text === "现价" || text === "最新价" || text === "收盘价" || lower === "current_price" || lower === "last_price" || lower === "close") {
    return "当前价";
  }
  if (text === "涨跌幅" || text === "涨跌幅(%)" || lower === "change_pct") {
    return "涨跌幅";
  }
  if (text === "开盘价" || lower === "open") {
    return "开盘价";
  }
  if (text === "最高价" || lower === "high") {
    return "最高价";
  }
  if (text === "最低价" || lower === "low") {
    return "最低价";
  }
  if (text === "成交量" || text === "成交量(手)" || lower === "volume") {
    return "成交量(手)";
  }
  if (text === "成交额" || text === "成交额(万)" || lower === "amount") {
    return "成交额(万)";
  }
  if (text === "换手率" || lower === "turnover_rate") {
    return "换手率";
  }
  if (text === "量比" || lower === "volume_ratio") {
    return "量比";
  }
  if (text === "趋势" || lower === "trend") {
    return "趋势";
  }
  if (text === "DIF" || lower === "dif" || lower === "macd_dif") {
    return "DIF";
  }
  if (text === "DEA" || lower === "dea" || lower === "macd_dea") {
    return "DEA";
  }
  if (text === "RSI6" || lower === "rsi6") {
    return "RSI6";
  }
  if (text === "RSI12" || lower === "rsi12") {
    return "RSI12";
  }
  if (text === "RSI24" || lower === "rsi24") {
    return "RSI24";
  }
  if (text === "K值" || text === "KDJ-K" || lower === "kdj_k") {
    return "KDJ-K";
  }
  if (text === "D值" || text === "KDJ-D" || lower === "kdj_d") {
    return "KDJ-D";
  }
  if (text === "J值" || text === "KDJ-J" || lower === "kdj_j") {
    return "KDJ-J";
  }
  return text;
}

const ENV_COMPONENT_KEY_MAP: Record<string, string> = {
  source_prior: "Env component:source_prior",
  trend_regime: "Env component:trend_regime",
  price_structure: "Env component:price_structure",
  momentum: "Env component:momentum",
  risk_balance: "Env component:risk_balance",
  liquidity: "Env component:liquidity",
  session: "Env component:session",
  execution_feedback: "执行反馈",
  account_posture: "账户态势",
};

const THRESHOLD_KEY_MAP: Record<string, string> = {
  buy_threshold: "Threshold:buy_threshold",
  sell_threshold: "Threshold:sell_threshold",
  max_position_ratio: "Threshold:max_position_ratio",
  allow_pyramiding: "Threshold:allow_pyramiding",
  confirmation: "Threshold:confirmation",
  dynamic_stop_loss_pct: "动态止损(%)",
  dynamic_take_profit_pct: "动态止盈(%)",
  execution_feedback_delta: "执行反馈修正分",
  account_posture_delta: "账户态势修正分",
  available_cash_ratio: "可用资金占比",
  position_sizing_multiplier: "仓位缩放系数",
  suggested_position_pct: "建议仓位(%)",
};

function _localizeEnvComponentName(name: string): string {
  const normalized = String(name || "").trim().toLowerCase();
  const key = ENV_COMPONENT_KEY_MAP[normalized];
  if (!key) {
    return name;
  }
  if (key.includes(":")) {
    return t(key);
  }
  return key;
}

function _localizeThresholdName(rawName: string): string {
  const text = String(rawName || "").trim();
  if (!text) {
    return text;
  }
  const pureKey = text.startsWith("阈值.") ? text.slice(3) : text;
  const mapped = THRESHOLD_KEY_MAP[pureKey];
  const localized = mapped ? (mapped.includes(":") ? t(mapped) : mapped) : pureKey;
  return text.startsWith("阈值.") ? `${t("Threshold prefix")}${localized}` : localized;
}

function _localizeComponentBreakdownLine(line: string): string {
  const text = String(line || "").trim();
  const match = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([+\-]?\d+(?:\.\d+)?)$/.exec(text);
  if (!match) {
    return _localizeDynamicText(text);
  }
  return `${_localizeEnvComponentName(match[1])}=${match[2]}`;
}

const STATUS_KEY_MAP: Record<string, string> = {
  pending: "Status:pending",
  observed: "Status:observed",
  delivered: "Status:delivered",
  executed: "Status:executed",
  failed: "Status:failed",
  cancelled: "Status:cancelled",
  canceled: "Status:canceled",
  skipped: "Status:skipped",
};

const SOURCE_LABEL_MAP: Record<string, string> = {
  tech_vote: "Source:tech_vote",
  tech_vote_reason: "Source:tech_vote_reason",
  reasoning: "Source:reasoning",
};

const TOKEN_KEY_MAP: Record<string, string> = {
  main_force: "Token:main_force",
  sideways: "Token:sideways",
  ContextScore: "Token:ContextScore",
  label: "Token:label",
  reason: "Token:reason",
  score: "Token:score",
  weight: "Token:weight",
  clamp: "Token:clamp",
  abs: "Token:abs",
  base_confidence: "Token:base_confidence",
  tech_score: "Token:tech_score",
  context_score: "Token:context_score",
  effective_thresholds: "Token:effective_thresholds",
  NA: "Token:NA",
  True: "Bool:true",
  False: "Bool:false",
  true: "Bool:true",
  false: "Bool:false",
};

function _escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function _replaceWholeWord(source: string, from: string, to: string): string {
  if (!from || !to) {
    return source;
  }
  return source.replace(new RegExp(`\\b${_escapeRegex(from)}\\b`, "g"), to);
}

function _localizeStatus(rawStatus: string): string {
  const value = String(rawStatus || "").trim();
  if (!value) {
    return "--";
  }
  const key = STATUS_KEY_MAP[value.toLowerCase()];
  return key ? t(key) : value;
}

function _localizeSourceLabel(rawSource: string): string {
  const source = String(rawSource || "").trim();
  if (!source) {
    return "--";
  }
  const direct = SOURCE_LABEL_MAP[source];
  if (direct) {
    return t(direct);
  }
  if (source.includes("DualTrackResolver")) {
    return t("Source:DualTrackResolver");
  }
  if (source.includes("KernelStrategyRuntime")) {
    return t("Source:KernelStrategyRuntime");
  }
  if (source.includes("MarketRegimeContextProvider")) {
    return t("Source:MarketRegimeContextProvider");
  }
  if (source.includes("scheduler") || source.includes("sim_runs") || source.includes("调度配置/回放任务")) {
    return t("Source:SchedulerReplay");
  }
  return _localizeDynamicText(source);
}

function _localizeValue(rawValue: string): string {
  const value = String(rawValue || "").trim();
  if (!value) {
    return "--";
  }
  if (value === "CN") {
    return t("Market:CN");
  }
  const boolKey = TOKEN_KEY_MAP[value];
  if (boolKey) {
    return t(boolKey);
  }
  return _localizeDynamicText(value);
}

function _localizeDynamicText(rawText: string): string {
  let text = String(rawText || "");
  if (!text) {
    return text;
  }

  text = text.replace(/\b(dual_track_[a-z_]+|sell_divergence|buy_divergence|resonance_[a-z_]+|neutral_hold|full|heavy|moderate|light)\b/gi, (matched) =>
    localizeDecisionCode(matched),
  );
  text = text.replace(/\b(BUY|SELL|HOLD|CONTEXT)\b/g, (matched) => localizeDecisionCode(matched));
  text = text.replace(/\b(pending|observed|delivered|executed|failed|cancelled|canceled|skipped)\b/gi, (matched) => _localizeStatus(matched));
  text = text.replace(/\b(source_prior|trend_regime|price_structure|momentum|risk_balance|liquidity|session)\b/g, (matched) => _localizeEnvComponentName(matched));
  text = text.replace(/\b(buy_threshold|sell_threshold|max_position_ratio|allow_pyramiding|confirmation)\b/g, (matched) => _localizeThresholdName(matched));

  for (const [token, key] of Object.entries(TOKEN_KEY_MAP)) {
    text = _replaceWholeWord(text, token, t(key));
  }

  return text;
}

function _parseNumeric(raw: string): number | null {
  const text = String(raw || "").replace(/,/g, "").trim();
  if (!text) {
    return null;
  }
  const match = text.match(/[+\-]?\d+(\.\d+)?/);
  if (!match) {
    return null;
  }
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function _formatSigned(value: number | null, digits = 4): string {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export function SignalDetailPage() {
  const isCompactLayout = useCompactLayout();
  const navigate = useNavigate();
  const { signalId } = useParams();
  const [searchParams] = useSearchParams();
  const source = useMemo(() => (searchParams.get("source") || "auto").toLowerCase(), [searchParams]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SignalDetailPayload>(emptyDetail);
  const [marketRefreshSeq, setMarketRefreshSeq] = useState(0);
  const [marketRefreshPending, setMarketRefreshPending] = useState(false);

  useEffect(() => {
    const id = String(signalId || "").trim();
    if (!id) {
      setStatus("error");
      setError("缺少 signal id");
      return;
    }
    let mounted = true;
    async function load() {
      setStatus("loading");
      setError(null);
      const forceRefreshMarket = marketRefreshSeq > 0;
      try {
        const response = await fetch(
          `/api/v1/quant/signals/${encodeURIComponent(id)}?source=${encodeURIComponent(source)}${
            forceRefreshMarket ? "&refresh_market=1" : ""
          }`,
          {
            headers: { Accept: "application/json" },
          },
        );
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Request failed: ${response.status}`);
        }
        const payload = (await response.json()) as SignalDetailPayload;
        if (mounted) {
          setDetail(payload);
          setStatus("ready");
          if (forceRefreshMarket) {
            setMarketRefreshPending(false);
          }
        }
      } catch (err) {
        if (mounted) {
          setStatus("error");
          setError(err instanceof Error ? err.message : String(err));
          if (forceRefreshMarket) {
            setMarketRefreshPending(false);
          }
        }
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [signalId, source, marketRefreshSeq]);

  if (status === "loading") {
    return <PageLoadingState title="信号详情加载中" description="正在读取投票明细、决策依据和技术指标快照。" />;
  }

  if (status === "error") {
    return (
      <PageErrorState
        title="信号详情加载失败"
        description={error ?? "无法加载信号详情，请稍后重试。"}
        actionLabel="返回"
        onAction={() => navigate(-1)}
      />
    );
  }

  if (!detail?.decision?.id) {
    return <PageEmptyState title="信号详情为空" description="当前信号没有可展示内容。" actionLabel="返回" onAction={() => navigate(-1)} />;
  }

  const decision = detail.decision;
  const explanation = detail.explanation ?? {};
  const techEvidence = explanation.techEvidence ?? [];
  const contextEvidence = explanation.contextEvidence ?? [];
  const contextScoreExplain = explanation.contextScoreExplain ?? {
    formula: "",
    confidenceFormula: "",
    componentBreakdown: [],
    componentSum: 0,
    finalScore: decision.contextScore,
  };
  const parameterDetails = detail.parameterDetails ?? [];
  const technicalRows = detail.technicalIndicators;
  const environmentRows = detail.contextVotes;
  const technicalParameterRows: ParameterDetailRow[] = [];
  const environmentParameterRows: ParameterDetailRow[] = [];
  const decisionParameterRows: ParameterDetailRow[] = [];
  const thresholdRows: ParameterDetailRow[] = [];
  for (const item of parameterDetails) {
    const name = String(item.name || "");
    if (name.startsWith("指标.")) {
      technicalParameterRows.push(item);
      continue;
    }
    if (name.startsWith("阈值.")) {
      thresholdRows.push(item);
      continue;
    }
    if (name.includes("环境") || name.includes("市场")) {
      environmentParameterRows.push(item);
      continue;
    }
    decisionParameterRows.push(item);
  }
  const originalAnalysis = explanation.original?.analysis || detail.analysis || "暂无分析数据";
  const originalReasoning = explanation.original?.reasoning || detail.reasoning || "暂无决策理由";
  const aiMonitor = detail.aiMonitor ?? emptyAiMonitor;
  const marketIndicatorByName = new Map<string, AiMonitorValueRow>();
  for (const item of aiMonitor.marketData ?? []) {
    const key = _normalizeIndicatorName(item.label);
    if (!key || marketIndicatorByName.has(key)) {
      continue;
    }
    marketIndicatorByName.set(key, item);
  }
  const technicalParamByName = new Map<string, ParameterDetailRow>();
  const consumedTechnicalParamNames = new Set<string>();
  for (const item of technicalParameterRows) {
    const key = String(item.name || "").replace(/^指标\./, "");
    if (!key) {
      continue;
    }
    if (!technicalParamByName.has(key)) {
      technicalParamByName.set(key, item);
    }
  }
  const mergedTechnicalRows = technicalRows.map((item) => {
    const key = String(item.name || "");
    const matchedParam = technicalParamByName.get(key);
    if (matchedParam) {
      consumedTechnicalParamNames.add(key);
    }
    return {
      name: key || "--",
      value: _safeValue(item.value, matchedParam?.value),
      source: _safeValue(matchedParam?.source, item.source),
      detail: _safeValue(matchedParam?.derivation, item.note),
    };
  });
  for (const item of technicalParameterRows) {
    const key = String(item.name || "").replace(/^指标\./, "");
    if (!key || consumedTechnicalParamNames.has(key)) {
      continue;
    }
    mergedTechnicalRows.push({
      name: key,
      value: _safeValue(item.value),
      source: _safeValue(item.source),
      detail: _safeValue(item.derivation),
    });
  }
  const mergedTechnicalNormalizedNames = new Set(mergedTechnicalRows.map((item) => _normalizeIndicatorName(item.name)));
  for (const indicatorName of REQUIRED_MARKET_TECHNICAL_INDICATORS) {
    const normalizedName = _normalizeIndicatorName(indicatorName);
    if (mergedTechnicalNormalizedNames.has(normalizedName)) {
      continue;
    }
    const marketItem = marketIndicatorByName.get(normalizedName);
    mergedTechnicalRows.push({
      name: indicatorName,
      value: _safeValue(marketItem?.value),
      source: _safeValue(marketItem ? "行情快照" : ""),
      detail: _safeValue(marketItem?.note),
    });
    mergedTechnicalNormalizedNames.add(normalizedName);
  }
  const voteOverview = detail.voteOverview ?? {
    voterCount: 0,
    technicalVoterCount: 0,
    contextVoterCount: 0,
    formula: "",
    technicalAggregation: "",
    contextAggregation: "",
    rows: [],
  };
  const voteRows = voteOverview.rows ?? [];
  const technicalVoteRows = voteRows.filter((item) => item.track === "technical");
  const contextVoteRows = voteRows.filter((item) => item.track === "context");
  const totalTechnicalVotes = technicalVoteRows.length;
  const totalContextVotes = contextVoteRows.length;
  const technicalWeightSum = technicalVoteRows.reduce((sum, item) => sum + (_parseNumeric(item.weight) ?? 1), 0);
  const contextWeightSum = contextVoteRows.reduce((sum, item) => sum + (_parseNumeric(item.weight) ?? 1), 0);
  const technicalContribution = technicalVoteRows.reduce((sum, item) => sum + (_parseNumeric(item.contribution) ?? 0), 0);
  const contextContribution = contextVoteRows.reduce((sum, item) => sum + (_parseNumeric(item.contribution) ?? 0), 0);
  const contextComponentSum = _parseNumeric(String(contextScoreExplain.componentSum ?? ""));
  const contextFinalScore = _parseNumeric(String(contextScoreExplain.finalScore ?? decision.contextScore));
  const signalCount = technicalVoteRows.reduce(
    (acc, item) => {
      const signal = String(item.signal || "").toUpperCase();
      if (signal === "BUY") acc.buy += 1;
      else if (signal === "SELL") acc.sell += 1;
      else acc.hold += 1;
      return acc;
    },
    { buy: 0, sell: 0, hold: 0 },
  );
  const topContextDrivers = [...contextVoteRows]
    .map((item) => ({
      factor: item.voter,
      contribution: _parseNumeric(item.contribution) ?? _parseNumeric(item.score) ?? 0,
      reason: item.reason,
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3);
  const findThreshold = (name: string) =>
    thresholdRows.find((item) => String(item.name || "").replace(/^阈值\./, "").trim().toLowerCase() === name.toLowerCase())?.value ?? "--";
  const buyThreshold = findThreshold("buy_threshold");
  const sellThreshold = findThreshold("sell_threshold");
  const maxPositionRatio = findThreshold("max_position_ratio");
  const allowPyramiding = findThreshold("allow_pyramiding");
  const confirmation = findThreshold("confirmation");
  const marketValue =
    decisionParameterRows.find((item) => String(item.name || "").trim() === "市场")?.value
    || (decision as unknown as { market?: string }).market
    || "--";
  const basisList = explanation.basis ?? [];
  const voteActorLines = voteRows.map((item) => {
    const trackLabel = item.track === "context" ? "环境" : "技术";
    const voterLabel = item.track === "context" ? _localizeEnvComponentName(item.voter) : _localizeDynamicText(item.voter);
    return `${trackLabel}｜${voterLabel}：投票 ${localizeDecisionCode(item.signal)}，权重 ${item.weight}，贡献 ${item.contribution}，依据 ${_localizeDynamicText(item.reason || "--")}`;
  });
  const keepPositionPct = (() => {
    const actionUpper = String(decision.action || "").trim().toUpperCase();
    const raw = Number(String(decision.positionSizePct ?? "").replace("%", "").trim());
    if (actionUpper === "HOLD") {
      return "维持当前仓位（不变）";
    }
    if (!Number.isFinite(raw)) {
      return "--";
    }
    const ratio = Math.max(0, Math.min(100, raw));
    if (actionUpper === "SELL") {
      const keep = Math.max(0, 100 - ratio);
      return String(Number(keep.toFixed(2)));
    }
    if (actionUpper === "BUY") {
      return String(Number(ratio.toFixed(2)));
    }
    return "--";
  })();
  const positionMetricLabel =
    String(decision.action || "").toUpperCase() === "BUY"
      ? "目标买入仓位(%)"
      : String(decision.action || "").toUpperCase() === "SELL"
      ? "建议卖出比例(%)"
      : "仓位建议(%)";

  return (
    <div>
      <PageHeader
        eyebrow="信号"
        title={`信号详情 #${decision.id}`}
        description={`${decision.stockCode} ${decision.stockName || ""} · ${localizeDecisionCode(decision.action)} · ${_localizeStatus(decision.status)}`}
        actions={
          <div className="chip-row">
            <button className="button button--secondary" type="button" onClick={() => navigate(-1)}>
              返回
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={marketRefreshPending}
              onClick={() => {
                setMarketRefreshPending(true);
                setMarketRefreshSeq((current) => current + 1);
              }}
            >
              {marketRefreshPending ? "刷新中..." : "刷新行情"}
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => navigate(decision.source === "replay" ? "/his-replay" : "/live-sim")}
            >
              {decision.source === "replay" ? "历史回放" : "实时模拟"}
            </button>
          </div>
        }
      />

      <div className="stack">
        <WorkbenchCard>
          <h2 className="section-card__title">决策概览</h2>

          <div className="summary-item summary-item--accent">
            <div className="summary-item__title">结论</div>
            <div className="summary-item__body">
              {`${localizeDecisionCode(decision.finalAction)} · ${localizeDecisionCode(decision.decisionType)} · 代码 ${decision.stockCode} · 决策点 ${decision.checkpointAt}`}
            </div>
            <div className="summary-item__body markdown-body" style={{ whiteSpace: "pre-wrap" }}>
              {_localizeDynamicText(explanation.summary || "暂无结构化结论")}
            </div>
          </div>

          <div className="mini-metric-grid" style={{ marginTop: "14px" }}>
            <div className="mini-metric"><div className="mini-metric__label">动作</div><div className="mini-metric__value">{localizeDecisionCode(decision.action)}</div></div>
            <div className="mini-metric"><div className="mini-metric__label">决策类型</div><div className="mini-metric__value">{localizeDecisionCode(decision.decisionType)}</div></div>
            <div className="mini-metric"><div className="mini-metric__label">策略模式</div><div className="mini-metric__value">{localizeStrategyMode(decision.strategyMode)}</div></div>
            <div className="mini-metric"><div className="mini-metric__label">置信度</div><div className="mini-metric__value">{decision.confidence}</div></div>
            <div className="mini-metric"><div className="mini-metric__label">{positionMetricLabel}</div><div className="mini-metric__value">{decision.positionSizePct}</div></div>
            <div className="mini-metric"><div className="mini-metric__label">建议保持仓位</div><div className="mini-metric__value">{keepPositionPct}</div></div>
            <div className="mini-metric"><div className="mini-metric__label">技术分</div><div className="mini-metric__value">{decision.techScore}</div></div>
            <div className="mini-metric"><div className="mini-metric__label">环境分</div><div className="mini-metric__value">{decision.contextScore}</div></div>
            <div className="mini-metric"><div className="mini-metric__label">规则命中</div><div className="mini-metric__value">{localizeDecisionCode(decision.ruleHit)}</div></div>
          </div>

          <div className="card-divider" />
          <div className="summary-item">
            <div className="summary-item__title">依据与推导总览</div>
            <ol className="insight-list">
              <li>
                市场与上下文：
                {` 市场 ${_localizeValue(String(marketValue))}，市场状态 ${_localizeDynamicText(decision.marketRegime)}，策略模式 ${localizeStrategyMode(decision.strategyMode)}，分析粒度 ${_localizeDynamicText(decision.analysisTimeframe)}。`}
              </li>
              <li>
                投票主体与权重：
                {` 技术轨 ${totalTechnicalVotes} 个主体（轨内总权重 ${technicalWeightSum.toFixed(4)}），环境轨 ${totalContextVotes} 个主体（轨内总权重 ${contextWeightSum.toFixed(4)}）。`}
                {` 这里的“总权重”仅用于各自轨道内部聚合，不代表双轨融合阶段的“技术/环境配比”。`}
                {` 双轨融合阶段没有固定“技术x% + 环境x%”线性权重，而是先得到技术信号与环境信号，再由规则引擎（共振/背离/否决）决定最终动作与仓位。`}
              </li>
              <li>
                技术轨权重：
                {` 看多 ${signalCount.buy} 票、看空 ${signalCount.sell} 票、持有 ${signalCount.hold} 票（共 ${totalTechnicalVotes} 票）。`}
                {` 单票贡献分 = 信号分 × 权重；技术贡献和 = 所有技术票贡献分求和 = ${_formatSigned(technicalContribution)}。`}
                {` 解释：贡献和 > 0 代表技术偏多，< 0 代表技术偏空，= 0 代表技术中性。`}
                {` 当前为 ${_formatSigned(technicalContribution)}，所以技术信号是 ${localizeDecisionCode(decision.techSignal)}。`}
              </li>
              <li>
                环境轨权重：
                {` 共 ${totalContextVotes} 个环境因子参与投票。环境贡献和 = 所有环境票贡献分求和 = ${_formatSigned(contextContribution)}。`}
                {` 环境分 = 对环境贡献和按模型规则截断/映射后的分值（通常越大越偏多）。`}
                {` 当前组件和 ${_formatSigned(contextComponentSum)}，截断后环境分 ${_formatSigned(contextFinalScore)}（页面显示 ${decision.contextScore}）。`}
                {` 因此环境信号是 ${localizeDecisionCode(decision.contextSignal)}。`}
                {contextScoreExplain.formula ? ` 计算公式：${_localizeDynamicText(contextScoreExplain.formula)}` : ""}
              </li>
              <li>
                双轨融合：
                {` 技术信号 ${localizeDecisionCode(decision.techSignal)} + 环境信号 ${localizeDecisionCode(decision.contextSignal)} `}
                {`→ 共振 ${localizeDecisionCode(decision.resonanceType)} → 规则 ${localizeDecisionCode(decision.ruleHit)} `}
                {`→ 最终 ${localizeDecisionCode(decision.finalAction)}`}
              </li>
              <li>
                仓位计算：
                {` 先根据最终动作与置信度给出 ${positionMetricLabel} ${decision.positionSizePct}，再叠加风控约束得到最终仓位建议。`}
                {` 当前建议保持仓位 ${keepPositionPct}，置信度 ${decision.confidence}。`}
                {` 风控参数含义：buy_threshold(${buyThreshold}) 为触发买入阈值；sell_threshold(${sellThreshold}) 为触发卖出阈值；`}
                {`max_position_ratio(${maxPositionRatio}) 为单票仓位上限；allow_pyramiding(${allowPyramiding}) 是否允许加仓；confirmation(${confirmation}) 为信号确认条件。`}
              </li>
            </ol>
            {voteActorLines.length > 0 ? (
              <div className="summary-item__body" style={{ marginTop: "8px" }}>
                <div className="summary-item__title" style={{ fontSize: "0.96rem", marginBottom: "4px" }}>投票主体明细（逐条）</div>
                <ul className="insight-list">
                  {voteActorLines.map((line, index) => (
                    <li key={`vote-actor-line-${index}`}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {topContextDrivers.length > 0 ? (
              <div className="summary-item__body" style={{ marginTop: "6px" }}>
                关键环境因子：
                {topContextDrivers
                  .map(
                    (item) =>
                      `${_localizeEnvComponentName(item.factor)}(${_formatSigned(item.contribution)}) - ${_localizeDynamicText(item.reason || "--")}`,
                  )
                  .join("；")}
              </div>
            ) : null}
            {basisList.length > 0 ? (
              <div className="summary-item__body" style={{ marginTop: "6px" }}>
                <div className="summary-item__title" style={{ fontSize: "0.96rem", marginBottom: "4px" }}>原始依据链路</div>
                <ul className="insight-list">
                  {basisList.map((item, index) => (
                    <li key={`basis-line-${index}`}>{_localizeDynamicText(item)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="card-divider" />
          <h3 className="section-card__title" style={{ fontSize: "1.1rem" }}>决策指标</h3>
          <CompactDataTable
            isCompactLayout={isCompactLayout}
            headers={["参数", "值", "来源", "计算方式"]}
            coreIndexes={[0, 1, 2]}
            emptyText="暂无决策指标"
            rows={decisionParameterRows.map((item, index) => ({
              key: `decision-${index}`,
              cells: [
                _localizeDynamicText(item.name),
                _localizeValue(item.value),
                _localizeSourceLabel(item.source),
                _localizeDynamicText(item.derivation),
              ],
            }))}
          />
          {thresholdRows.length > 0 ? (
            <div style={{ marginTop: "10px" }}>
              <CompactDataTable
                isCompactLayout={isCompactLayout}
                headers={["阈值参数", "值", "来源", "计算方式"]}
                coreIndexes={[0, 1, 2]}
                emptyText="暂无阈值参数"
                rows={thresholdRows.map((item, index) => ({
                  key: `threshold-${index}`,
                  cells: [
                    _localizeThresholdName(item.name),
                    _localizeValue(item.value),
                    _localizeSourceLabel(item.source),
                    _localizeDynamicText(item.derivation),
                  ],
                }))}
              />
            </div>
          ) : null}

          <div className="card-divider" />
          <h3 className="section-card__title" style={{ fontSize: "1.1rem" }}>技术指标</h3>
          <CompactDataTable
            isCompactLayout={isCompactLayout}
            headers={["指标", "数值", "来源", "说明/计算方式"]}
            coreIndexes={[0, 1, 2]}
            emptyText="暂无技术指标"
            rows={mergedTechnicalRows.map((item, index) => ({
              key: `tech-${index}`,
              cells: [
                _localizeDynamicText(item.name),
                _localizeValue(item.value),
                _localizeSourceLabel(item.source),
                _localizeDynamicText(item.detail || "--"),
              ],
            }))}
          />
          {techEvidence.length > 0 ? (
            <div className="summary-item" style={{ marginTop: "10px" }}>
              <div className="summary-item__title">关键技术证据</div>
              <ul className="insight-list">
                {techEvidence.map((item) => (
                  <li key={item}>{_localizeDynamicText(item)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="card-divider" />
          <h3 className="section-card__title" style={{ fontSize: "1.1rem" }}>环境指标</h3>
          <div className="summary-item">
            <div className="summary-item__title">环境分计算</div>
            <div className="summary-item__body">{_localizeDynamicText(contextScoreExplain.formula || "暂无环境分公式")}</div>
            <div className="summary-item__body">{_localizeDynamicText(contextScoreExplain.confidenceFormula || "暂无环境置信度公式")}</div>
            <div className="summary-item__body">
              {`组件和=${String(contextScoreExplain.componentSum ?? "0")}，最终环境分=${contextScoreExplain.finalScore || decision.contextScore}`}
            </div>
            {(contextScoreExplain.componentBreakdown ?? []).length > 0 ? (
              <ul className="insight-list">
                {(contextScoreExplain.componentBreakdown ?? []).map((item) => (
                  <li key={item}>{_localizeComponentBreakdownLine(item)}</li>
                ))}
              </ul>
              ) : null}
          </div>
          <CompactDataTable
            isCompactLayout={isCompactLayout}
            headers={["环境因子", "分值", "说明"]}
            coreIndexes={[0, 1]}
            emptyText="暂无环境指标"
            rows={environmentRows.map((item, index) => ({
              key: `ctx-${index}`,
              cells: [_localizeEnvComponentName(item.factor), item.score, _localizeDynamicText(item.reason)],
            }))}
          />
          {environmentParameterRows.length > 0 ? (
            <div style={{ marginTop: "10px" }}>
              <CompactDataTable
                isCompactLayout={isCompactLayout}
                headers={["环境参数", "值", "来源", "计算方式"]}
                coreIndexes={[0, 1, 2]}
                emptyText="暂无环境参数"
                rows={environmentParameterRows.map((item, index) => ({
                  key: `env-param-${index}`,
                  cells: [
                    _localizeDynamicText(item.name),
                    _localizeValue(item.value),
                    _localizeSourceLabel(item.source),
                    _localizeDynamicText(item.derivation),
                  ],
                }))}
              />
            </div>
          ) : null}
          {contextEvidence.length > 0 ? (
            <div className="summary-item" style={{ marginTop: "10px" }}>
              <div className="summary-item__title">关键环境证据</div>
              <ul className="insight-list">
                {contextEvidence.map((item) => (
                  <li key={item}>{_localizeDynamicText(item)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="card-divider" />
          <div className="summary-item">
            <div className="summary-item__title">原始模型文本</div>
            <div className="summary-item__body markdown-body" style={{ whiteSpace: "pre-wrap" }}>{_localizeDynamicText(originalAnalysis)}</div>
            <div className="summary-item__body markdown-body" style={{ whiteSpace: "pre-wrap" }}>{_localizeDynamicText(originalReasoning)}</div>
          </div>
        </WorkbenchCard>
      </div>
    </div>
  );
}
