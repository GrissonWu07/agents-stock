import { useEffect, useMemo, useState } from "react";
import type { WorkbenchSnapshot } from "../../lib/page-models";
import { Sparkline } from "../../components/ui/sparkline";
import { WorkbenchCard } from "../../components/ui/workbench-card";

type AnalyzePayload = {
  symbol: string;
  analysts: string[];
  mode: string;
  cycle: string;
};

type BatchAnalyzePayload = {
  stockCodes: string[];
  analysts: string[];
  mode: string;
  cycle: string;
};

type StockAnalysisPanelProps = {
  analysis: WorkbenchSnapshot["analysis"];
  analysisJob?: WorkbenchSnapshot["analysisJob"];
  inputSeed?: string;
  onAnalyze: (payload: AnalyzePayload) => void;
  onBatchAnalyze: (payload: BatchAnalyzePayload) => void;
  onClearInput: () => void;
  busy?: boolean;
  busyMessage?: string;
  refreshFailure?: {
    title: string;
    body: string;
    generatedAt?: string;
  } | null;
};

const splitSymbols = (input: string) =>
  input
    .split(/[,\s，；;、\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const MetricCard = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="mini-metric">
    <div className="mini-metric__label">{label}</div>
    <div className="mini-metric__value">{value}</div>
    {hint ? <div className="mini-metric__hint">{hint}</div> : null}
  </div>
);

const MODE_OPTIONS = ["单个分析", "批量分析"] as const;
const CYCLE_OPTIONS = ["1y", "1d", "30m"] as const;
const DEFAULT_ANALYSTS = ["technical", "fundamental", "fund_flow", "risk"];

type StageState = "waiting" | "running" | "completed";

const STAGE_LABELS = {
  analyst: "分析师观点",
  discussion: "团队讨论",
  decision: "最终决策",
} as const;

const resolveStageState = (
  target: keyof typeof STAGE_LABELS,
  stage: string | undefined,
  busy: boolean,
): StageState => {
  if (!busy) return "completed";
  if (stage === "completed") return "completed";
  const stageOrder = ["queued", "fetch", "enrich", "analyst", "discussion", "decision", "persist", "completed"];
  const currentIndex = stageOrder.indexOf(stage ?? "queued");
  const targetIndex = stageOrder.indexOf(target);
  if (currentIndex === -1 || targetIndex === -1) return "waiting";
  if (currentIndex === targetIndex) return "running";
  if (currentIndex > targetIndex) return "completed";
  return "waiting";
};

const StageBadge = ({ state }: { state: StageState }) => {
  if (state === "completed") {
    return <span className="analysis-stage__badge analysis-stage__badge--completed">已完成</span>;
  }
  if (state === "running") {
    return (
      <span className="analysis-stage__badge analysis-stage__badge--running">
        <span className="analysis-stage__spinner" aria-hidden="true" />
        进行中
      </span>
    );
  }
  return <span className="analysis-stage__badge analysis-stage__badge--waiting">等待上一步完成</span>;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatMarkdownInline = (value: string) =>
  value
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

const markdownToHtml = (markdown: string) => {
  const source = escapeHtml(markdown || "").replaceAll("\r\n", "\n");
  const lines = source.split("\n");
  const html: string[] = [];
  const paragraphBuffer: string[] = [];
  let inUl = false;
  let inOl = false;
  let inCode = false;
  const codeBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    html.push(`<p>${formatMarkdownInline(paragraphBuffer.join("<br />"))}</p>`);
    paragraphBuffer.length = 0;
  };

  const closeLists = () => {
    if (inUl) {
      html.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      html.push("</ol>");
      inOl = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (inCode) {
      if (trimmed.startsWith("```")) {
        html.push(`<pre><code>${codeBuffer.join("\n")}</code></pre>`);
        inCode = false;
        codeBuffer.length = 0;
      } else {
        codeBuffer.push(line);
      }
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushParagraph();
      closeLists();
      inCode = true;
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      closeLists();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      closeLists();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${formatMarkdownInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      closeLists();
      html.push(`<blockquote>${formatMarkdownInline(quoteMatch[1])}</blockquote>`);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (inOl) {
        html.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        html.push("<ul>");
        inUl = true;
      }
      html.push(`<li>${formatMarkdownInline(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (inUl) {
        html.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        html.push("<ol>");
        inOl = true;
      }
      html.push(`<li>${formatMarkdownInline(olMatch[1])}</li>`);
      continue;
    }

    closeLists();
    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  closeLists();

  if (inCode) {
    html.push(`<pre><code>${codeBuffer.join("\n")}</code></pre>`);
  }

  return html.join("");
};

const MarkdownBlock = ({ content, className }: { content: string; className?: string }) => {
  const html = useMemo(() => markdownToHtml(content), [content]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

const resolveSelectedAnalysts = (analysts: WorkbenchSnapshot["analysis"]["analysts"]) => {
  const selected = analysts.filter((item) => item.selected).map((item) => item.value);
  return selected.length > 0 ? selected : DEFAULT_ANALYSTS;
};

export function StockAnalysisPanel({
  analysis,
  analysisJob = null,
  inputSeed = "",
  onAnalyze,
  onBatchAnalyze,
  onClearInput,
  busy = false,
  busyMessage = "正在分析，请稍候...",
  refreshFailure = null,
}: StockAnalysisPanelProps) {
  const [symbol, setSymbol] = useState(analysis.symbol);
  const [mode, setMode] = useState(analysis.mode);
  const [cycle, setCycle] = useState(analysis.cycle);
  const [selectedAnalysts, setSelectedAnalysts] = useState(resolveSelectedAnalysts(analysis.analysts));

  useEffect(() => {
    setSymbol(analysis.symbol);
    setMode(analysis.mode);
    setCycle(analysis.cycle);
    setSelectedAnalysts(resolveSelectedAnalysts(analysis.analysts));
  }, [analysis]);

  useEffect(() => {
    const codes = splitSymbols(inputSeed);
    if (codes.length === 0) return;
    setSymbol(codes.join(","));
    if (codes.length > 1) {
      setMode("批量分析");
    }
  }, [inputSeed]);

  const analystViews = analysis.analystViews ?? analysis.insights.filter((item) => item.title.includes("分析师"));
  const decisionInsights = analysis.insights.filter((item) => !item.title.includes("分析师"));
  const operationInsights = decisionInsights.filter((item) => item.title.includes("操作建议"));
  const otherDecisionInsights = decisionInsights.filter((item) => !item.title.includes("操作建议"));
  const [activeAnalystTitle, setActiveAnalystTitle] = useState<string>("");

  useEffect(() => {
    if (analystViews.length === 0) {
      setActiveAnalystTitle("");
      return;
    }
    setActiveAnalystTitle((current) =>
      analystViews.some((item) => item.title === current) ? current : analystViews[0].title,
    );
  }, [analystViews]);

  const activeAnalystView = analystViews.find((item) => item.title === activeAnalystTitle) ?? analystViews[0] ?? null;

  const stageKey = analysisJob?.stage ?? (busy ? "queued" : "completed");
  const analystStage = resolveStageState("analyst", stageKey, busy);
  const discussionStage = resolveStageState("discussion", stageKey, busy);
  const decisionStage = resolveStageState("decision", stageKey, busy);
  const hasCachedAnalysis = Boolean(analysis.generatedAt || analysis.summaryBody || analystViews.length > 0);

  const handleToggleAnalyst = (value: string) => {
    setSelectedAnalysts((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const handleSmartAnalyze = () => {
    const stockCodes = splitSymbols(symbol);
    if (stockCodes.length === 0 || selectedAnalysts.length === 0) return;
    if (stockCodes.length === 1) {
      onAnalyze({
        symbol: stockCodes[0],
        analysts: selectedAnalysts,
        mode: "单个分析",
        cycle,
      });
      return;
    }
    onBatchAnalyze({
      stockCodes,
      analysts: selectedAnalysts,
      mode: "批量分析",
      cycle,
    });
  };

  const hasBatchCodes = splitSymbols(symbol).length > 0;
  const canAnalyze = hasBatchCodes && selectedAnalysts.length > 0;
  const operationAdvice = operationInsights.map((item) => item.body).filter(Boolean).join("\n\n");

  return (
    <WorkbenchCard className={busy ? "analysis-panel analysis-panel--busy" : "analysis-panel"}>
      <h2 className="section-card__title">股票分析</h2>
      <p className="section-card__description">
        按分析团队、分析配置、股票代码和结果的顺序组织，用户从上到下就能完成一次完整分析，不用在页面里来回找入口。
      </p>

      {refreshFailure ? (
        <div className="summary-item summary-item--accent analysis-panel__refresh-notice" role="status" aria-live="polite">
          <div className="summary-item__title">{refreshFailure.title}</div>
          <div className="summary-item__body">当前显示的是最近一次成功分析，新的刷新未完成时不会覆盖已有结果。</div>
          {refreshFailure.body ? <div className="summary-item__body" style={{ marginTop: "6px" }}>{refreshFailure.body}</div> : null}
          {refreshFailure.generatedAt ? (
            <div className="summary-item__meta">生成时间：{refreshFailure.generatedAt}</div>
          ) : null}
        </div>
      ) : null}

      <div className="summary-list">
        <section className="summary-item">
          <div className="summary-item__title">1. 分析团队</div>
          <div className="summary-item__body">
            先选参与本次判断的视角。默认阵容覆盖技术、基本面、资金面、市场情绪和风险管理，新闻分析可以按需补充。
          </div>
          <div className="chip-row" style={{ marginTop: "12px" }}>
            {analysis.analysts.map((team) => (
              <button
                key={team.value}
                className={`chip${selectedAnalysts.includes(team.value) ? " chip--active" : ""}`}
                type="button"
                onClick={() => handleToggleAnalyst(team.value)}
              >
                {team.label}
              </button>
            ))}
          </div>
        </section>

        <section className="summary-item">
          <div className="summary-item__title">2. 分析配置</div>
          <div className="summary-item__body">先把分析模式和数据周期确定下来，再输入股票代码开始分析。</div>
          <div className="section-grid" style={{ marginTop: "12px" }}>
            <label className="field">
              <span className="field__label">分析模式</span>
              <select className="input" value={mode} onChange={(event) => setMode(event.target.value)}>
                {MODE_OPTIONS.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">数据周期</span>
              <select className="input" value={cycle} onChange={(event) => setCycle(event.target.value)}>
                {CYCLE_OPTIONS.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="summary-item">
          <div className="summary-item__title">3. 股票代码</div>
          <div className="summary-item__body">
            输入单只股票代码即可分析；切换到批量模式时，也可以用逗号、空格或换行分隔多个代码。
          </div>
          <div className="watchlist-entry" style={{ marginTop: "12px" }}>
            <label className="field">
              <span className="field__label">股票代码 / 批量代码</span>
              <input className="input" placeholder={analysis.inputHint} value={symbol} onChange={(event) => setSymbol(event.target.value)} />
            </label>
            <div className="watchlist-entry__actions">
              <button className="button button--primary" type="button" onClick={handleSmartAnalyze} disabled={!canAnalyze || busy}>
                {busy ? "正在分析中..." : "开始分析"}
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => {
                  setSymbol("");
                  onClearInput();
                }}
                disabled={busy}
              >
                清空输入
              </button>
            </div>
          </div>
        </section>

        <section className="summary-item summary-item--accent">
          <div className="summary-item__title">4. 分析结果</div>
          <div className="summary-item__body">分析完成后，摘要、关键指标、决策和团队观点会按这个顺序展开。</div>

          {busy ? (
            <div className="analysis-stage-panel" role="status" aria-live="polite">
              <div className="analysis-stage-panel__header">
                <div className="analysis-stage-panel__title">本轮分析进度</div>
                <div className="analysis-stage-panel__message">{busyMessage}</div>
              </div>
              <div className="analysis-stage-grid">
                <div className={`analysis-stage analysis-stage--${analystStage}`}>
                  <div className="analysis-stage__title">{STAGE_LABELS.analyst}</div>
                  <div className="analysis-stage__body">
                    {analystStage === "waiting" ? "等待行情、财务和资金面数据准备完成。" : "多位分析师会先分别给出观点。"}
                  </div>
                  <StageBadge state={analystStage} />
                </div>
                <div className={`analysis-stage analysis-stage--${discussionStage}`}>
                  <div className="analysis-stage__title">{STAGE_LABELS.discussion}</div>
                  <div className="analysis-stage__body">
                    {discussionStage === "waiting" ? "等待分析师观点返回后，再开始团队讨论。" : "正在汇总多位分析师观点并形成讨论纪要。"}
                  </div>
                  <StageBadge state={discussionStage} />
                </div>
                <div className={`analysis-stage analysis-stage--${decisionStage}`}>
                  <div className="analysis-stage__title">{STAGE_LABELS.decision}</div>
                  <div className="analysis-stage__body">
                    {decisionStage === "waiting" ? "等待团队讨论完成后，再生成最终决策。" : "正在整理最终结论、操作建议和风险提示。"}
                  </div>
                  <StageBadge state={decisionStage} />
                </div>
              </div>
              {hasCachedAnalysis ? (
                <div className="analysis-stage-panel__hint">当前先展示最近一次成功分析，新的分析完成后会自动替换下面结果。</div>
              ) : null}
            </div>
          ) : null}

          <div className="summary-list" style={{ marginTop: "12px" }}>
            <div className="summary-item summary-item--accent">
              <div className="summary-item__title">{analysis.summaryTitle}</div>
              <MarkdownBlock className="summary-item__body markdown-body" content={analysis.summaryBody} />
              {analysis.generatedAt ? (
                <div className="summary-item__meta">生成时间：{analysis.generatedAt}</div>
              ) : null}
            </div>
          </div>

          <div className="summary-list" style={{ marginTop: "12px" }}>
            <div className="summary-item">
              <div className="summary-item__title">分析师观点</div>
            </div>
          </div>

          {analystViews.length > 0 && activeAnalystView ? (
            <div className="analyst-layout" style={{ marginTop: "12px" }}>
              <div className="analyst-layout__nav">
                {analystViews.map((insight, index) => (
                  <button
                    key={`${insight.title}-${index}`}
                    type="button"
                    className={`analyst-tab${insight.title === activeAnalystView.title ? " analyst-tab--active" : ""}`}
                    onClick={() => setActiveAnalystTitle(insight.title)}
                  >
                    {insight.title}
                  </button>
                ))}
              </div>
              <div className="analyst-layout__content">
                <div className="summary-item__title">{activeAnalystView.title}</div>
                <MarkdownBlock className="summary-item__body markdown-body" content={activeAnalystView.body} />
              </div>
            </div>
          ) : null}

          <div className="card-divider" />

          <div className="summary-list" style={{ marginTop: "12px" }}>
            <div className="summary-item">
              <div className="summary-item__title">量化证据</div>
            </div>
          </div>

          <div className="evidence-grid" style={{ marginTop: "12px" }}>
            <div className="summary-item">
              <div className="summary-item__title">关键指标</div>
              {analysis.indicators.length > 0 ? (
                <div className="mini-metric-grid" style={{ marginTop: "10px" }}>
                  {analysis.indicators.map((indicator) => (
                    <MetricCard key={indicator.label} label={indicator.label} value={indicator.value} hint={indicator.hint} />
                  ))}
                </div>
              ) : (
                <div className="summary-item__body">暂无指标数据</div>
              )}
            </div>
            <div className="summary-item">
              <div className="summary-item__title">走势摘要</div>
              <Sparkline points={analysis.curve} />
            </div>
          </div>

          <div className="decision-grid" style={{ marginTop: "12px" }}>
            <div className="summary-item summary-item--accent">
              <div className="summary-item__title">最终投资决策</div>
              <MarkdownBlock className="summary-item__body markdown-body" content={analysis.finalDecisionText ?? analysis.decision} />
            </div>
            <div className="summary-item">
              <div className="summary-item__title">操作建议</div>
              <MarkdownBlock
                className="summary-item__body markdown-body"
                content={operationAdvice || "暂无单独操作建议，请结合左侧最终投资决策执行。"}
              />
            </div>
          </div>

          {otherDecisionInsights.length > 0 ? (
            <div className="summary-list" style={{ marginTop: "12px" }}>
              {otherDecisionInsights.map((insight, index) => (
                <div className="summary-item" key={`${insight.title}-${index}`}>
                  <div className="summary-item__title">{insight.title}</div>
                  <MarkdownBlock className="summary-item__body markdown-body" content={insight.body} />
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </WorkbenchCard>
  );
}
