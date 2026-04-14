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
  onAnalyze: (payload: AnalyzePayload) => void;
  onBatchAnalyze: (payload: BatchAnalyzePayload) => void;
  onClearInput: () => void;
};

const splitSymbols = (input: string) =>
  input
    .split(/[,\s，；;、\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <div className="mini-metric">
    <div className="mini-metric__label">{label}</div>
    <div className="mini-metric__value">{value}</div>
  </div>
);

const MODE_OPTIONS = ["单个分析", "批量分析"] as const;
const CYCLE_OPTIONS = ["1y", "1d", "30m"] as const;

export function StockAnalysisPanel({ analysis, onAnalyze, onBatchAnalyze, onClearInput }: StockAnalysisPanelProps) {
  const [symbol, setSymbol] = useState(analysis.symbol);
  const [mode, setMode] = useState(analysis.mode);
  const [cycle, setCycle] = useState(analysis.cycle);
  const [selectedAnalysts, setSelectedAnalysts] = useState(
    analysis.analysts.filter((item) => item.selected).map((item) => item.value),
  );

  useEffect(() => {
    setSymbol(analysis.symbol);
    setMode(analysis.mode);
    setCycle(analysis.cycle);
    setSelectedAnalysts(analysis.analysts.filter((item) => item.selected).map((item) => item.value));
  }, [analysis]);

  const selectedAnalystLabels = useMemo(
    () => analysis.analysts.filter((item) => selectedAnalysts.includes(item.value)).map((item) => item.label),
    [analysis.analysts, selectedAnalysts],
  );

  const inputModeHint = mode === "批量分析" ? "支持输入多个代码，逗号、空格或换行分隔" : "支持输入单只股票代码";
  const executionHint =
    selectedAnalysts.length > 0
      ? `当前选择了 ${selectedAnalystLabels.join("、")}，系统会按这个组合生成统一结论。`
      : "请选择至少一个分析师，系统会把对应视角生成的结论汇总成统一结果。";

  const handleToggleAnalyst = (value: string) => {
    setSelectedAnalysts((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const handleAnalyze = () => {
    const nextSymbol = symbol.trim();
    if (!nextSymbol || selectedAnalysts.length === 0) return;
    onAnalyze({
      symbol: nextSymbol,
      analysts: selectedAnalysts,
      mode,
      cycle,
    });
  };

  const handleBatchAnalyze = () => {
    const stockCodes = splitSymbols(symbol);
    if (stockCodes.length === 0 || selectedAnalysts.length === 0) return;
    onBatchAnalyze({
      stockCodes,
      analysts: selectedAnalysts,
      mode,
      cycle,
    });
  };

  const hasBatchCodes = splitSymbols(symbol).length > 0;
  const canAnalyze = symbol.trim().length > 0 && selectedAnalysts.length > 0;
  const canBatchAnalyze = hasBatchCodes && selectedAnalysts.length > 0;

  return (
    <WorkbenchCard>
      <h2 className="section-card__title">股票分析</h2>
      <p className="section-card__description">
        按分析团队、分析配置、股票代码和结果的顺序组织，用户从上到下就能完成一次完整分析，不用在页面里来回找入口。
      </p>

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
          <div className="summary-list" style={{ marginTop: "12px" }}>
            <div className="summary-item summary-item--accent">
              <div className="summary-item__title">当前分析团队</div>
              <div className="summary-item__body">{executionHint}</div>
            </div>
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
          <div className="mini-metric-grid" style={{ marginTop: "12px" }}>
            <MetricCard label="当前模式" value={mode} />
            <MetricCard label="当前周期" value={cycle} />
            <MetricCard label="输入提示" value={inputModeHint} />
            <MetricCard label="分析状态" value={canAnalyze ? "可直接分析" : "等待补齐"} />
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
              <button className="button button--primary" type="button" onClick={handleAnalyze} disabled={!canAnalyze}>
                分析
              </button>
              <button className="button button--secondary" type="button" onClick={handleBatchAnalyze} disabled={!canBatchAnalyze}>
                批量分析
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => {
                  setSymbol("");
                  onClearInput();
                }}
              >
                清空输入
              </button>
            </div>
          </div>
        </section>

        <section className="summary-item summary-item--accent">
          <div className="summary-item__title">4. 分析结果</div>
          <div className="summary-item__body">分析完成后，摘要、关键指标、决策和团队观点会按这个顺序展开。</div>

          <div className="summary-list" style={{ marginTop: "12px" }}>
            <div className="summary-item summary-item--accent">
              <div className="summary-item__title">{analysis.summaryTitle}</div>
              <div className="summary-item__body">{analysis.summaryBody}</div>
            </div>
          </div>

          <div className="mini-metric-grid" style={{ marginTop: "12px" }}>
            {analysis.indicators.map((indicator) => (
              <MetricCard key={indicator.label} label={indicator.label} value={indicator.value} />
            ))}
          </div>

          <div className="summary-list" style={{ marginTop: "12px" }}>
            <div className="summary-item summary-item--accent">
              <div className="summary-item__title">最终决策</div>
              <div className="summary-item__body">{analysis.decision}</div>
            </div>
          </div>

          <div className="summary-list" style={{ marginTop: "12px" }}>
            {analysis.insights.map((insight) => (
              <div className="summary-item" key={insight.title}>
                <div className="summary-item__title">{insight.title}</div>
                <div className="summary-item__body">{insight.body}</div>
              </div>
            ))}
          </div>

          <div className="card-divider" />

          <div className="summary-item" style={{ marginTop: "12px" }}>
            <div className="summary-item__title">走势摘要</div>
            <Sparkline points={analysis.curve} />
          </div>
        </section>
      </div>
    </WorkbenchCard>
  );
}
