import { useEffect, useState } from "react";
import type { ApiClient } from "../../lib/api-client";
import { PageHeader } from "../../components/ui/page-header";
import { StrategyNarrativeCard } from "../../components/ui/strategy-narrative";
import { WorkbenchCard } from "../../components/ui/workbench-card";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../../components/ui/page-state";
import { Sparkline } from "../../components/ui/sparkline";
import { usePageData } from "../../lib/use-page-data";
import { toDisplayCount, toDisplayText } from "./quant-display";
import { QuantTableSectionCard } from "./quant-table-section";

const ANALYSIS_TIMEFRAME_OPTIONS = [
  { value: "30m", label: "30分钟" },
  { value: "1d", label: "日线" },
  { value: "1d+30m", label: "日线方向 + 30分钟确认" },
];

const STRATEGY_MODE_OPTIONS = [
  { value: "auto", label: "自动" },
  { value: "aggressive", label: "激进" },
  { value: "neutral", label: "中性" },
  { value: "defensive", label: "稳健" },
];

const MARKET_OPTIONS = ["CN", "HK", "US"] as const;

function parseIntervalMinutes(value: string) {
  const match = String(value).match(/(\d+)/);
  return match ? Number(match[1]) : 15;
}

function normalizeAnalysisTimeframe(value: string) {
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "日线") return "1d";
  if (normalized.includes("30分钟")) return "1d+30m";
  return ANALYSIS_TIMEFRAME_OPTIONS.find((option) => option.value === normalized)?.value ?? "30m";
}

function normalizeStrategyMode(value: string) {
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "aggressive" || normalized.includes("激进")) return "aggressive";
  if (normalized === "neutral" || normalized.includes("中性")) return "neutral";
  if (normalized === "defensive" || normalized.includes("稳健") || normalized.includes("防守")) return "defensive";
  return "auto";
}

function normalizeMarket(value: string) {
  const normalized = String(value).trim().toUpperCase();
  return MARKET_OPTIONS.includes(normalized as (typeof MARKET_OPTIONS)[number]) ? normalized : "CN";
}

function parseAutoExecute(value: string) {
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized.includes("开");
}

type LiveSimPageProps = {
  client?: ApiClient;
};

export function LiveSimPage({ client }: LiveSimPageProps) {
  const resource = usePageData("live-sim", client);
  const snapshot = resource.data;
  const snapshotVersion = snapshot?.updatedAt ?? "loading";
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [analysisTimeframe, setAnalysisTimeframe] = useState("30m");
  const [strategyMode, setStrategyMode] = useState("auto");
  const [market, setMarket] = useState<(typeof MARKET_OPTIONS)[number]>("CN");
  const [autoExecute, setAutoExecute] = useState(true);
  const [initialCash, setInitialCash] = useState(100000);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setIntervalMinutes(parseIntervalMinutes(snapshot.config.interval));
    setAnalysisTimeframe(normalizeAnalysisTimeframe(snapshot.config.timeframe));
    setStrategyMode(normalizeStrategyMode(snapshot.config.strategyMode));
    setMarket(normalizeMarket(snapshot.config.market) as (typeof MARKET_OPTIONS)[number]);
    setAutoExecute(parseAutoExecute(snapshot.config.autoExecute));
    setInitialCash(Number.parseFloat(String(snapshot.config.initialCapital)) || 100000);
  }, [snapshotVersion]);

  if (resource.status === "loading" && !resource.data) {
    return <PageLoadingState title="量化模拟加载中" description="正在读取定时任务配置、候选池和账户结果。" />;
  }

  if (resource.status === "error" && !resource.data) {
    return (
      <PageErrorState
        title="量化模拟加载失败"
        description={resource.error ?? "无法加载量化模拟数据，请稍后重试。"}
        actionLabel="重新加载"
        onAction={resource.refresh}
      />
    );
  }

  if (!snapshot) {
    return <PageEmptyState title="量化模拟暂无数据" description="后台尚未返回量化模拟快照。" actionLabel="刷新" onAction={resource.refresh} />;
  }

  const candidateCodes = snapshot.candidatePool.rows.map((row) => row.id);
  const candidateCount = toDisplayCount(snapshot.status.candidateCount, snapshot.candidatePool.rows.length);
  const runningState = toDisplayText(snapshot.status.running, "未知");

  return (
    <div>
      <PageHeader
        eyebrow="Quant"
        title="量化模拟"
        description="围绕共享量化候选池运行模拟账户、策略信号、自动执行和账户结果。"
        actions={
          <div className="chip-row">
            <span className="badge badge--neutral">快照 {snapshot.updatedAt}</span>
            <span className="badge badge--accent">候选 {candidateCount}</span>
            <span className="badge badge--success">{runningState}</span>
          </div>
        }
      />
      <div className="section-grid section-grid--sidebar">
        <div className="stack">
          <WorkbenchCard>
            <h2 className="section-card__title">定时任务配置</h2>
            <p className="section-card__description">
              {`资金池、粒度、策略模式和自动执行统一放在这里配置。启动后会从当前时点开始做真实模拟。`}
            </p>
            <div className="mini-metric-grid">
              <div className="mini-metric">
                <div className="mini-metric__label">间隔</div>
                <div className="mini-metric__value">{snapshot.config.interval}</div>
              </div>
              <div className="mini-metric">
                <div className="mini-metric__label">分析粒度</div>
                <div className="mini-metric__value">{snapshot.config.timeframe}</div>
              </div>
              <div className="mini-metric">
                <div className="mini-metric__label">策略模式</div>
                <div className="mini-metric__value">{snapshot.config.strategyMode}</div>
              </div>
            </div>
            <div className="card-divider" />
            <div className="summary-list">
              <label className="field">
                <span className="field__label">间隔(分钟)</span>
                <input
                  className="input"
                  min={5}
                  max={240}
                  step={5}
                  type="number"
                  value={intervalMinutes}
                  onChange={(event) => setIntervalMinutes(Number(event.target.value) || 15)}
                />
              </label>
              <label className="field">
                <span className="field__label">分析粒度</span>
                <select className="input" value={analysisTimeframe} onChange={(event) => setAnalysisTimeframe(event.target.value)}>
                  {ANALYSIS_TIMEFRAME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">策略模式</span>
                <select className="input" value={strategyMode} onChange={(event) => setStrategyMode(event.target.value)}>
                  {STRATEGY_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">市场</span>
                <select
                  className="input"
                  value={market}
                  onChange={(event) => setMarket(event.target.value as (typeof MARKET_OPTIONS)[number])}
                >
                  {MARKET_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">初始资金池(元)</span>
                <input
                  className="input"
                  min={10000}
                  step={1000}
                  type="number"
                  value={initialCash}
                  onChange={(event) => setInitialCash(Number(event.target.value) || 100000)}
                />
              </label>
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}>
                <input type="checkbox" checked={autoExecute} onChange={(event) => setAutoExecute(event.target.checked)} />
                <span className="field__label" style={{ marginBottom: 0 }}>
                  自动执行模拟交易
                </span>
              </label>
            </div>
            <div className="card-divider" />
            <div className="toolbar toolbar--compact">
              <button
                className="button button--secondary"
                type="button"
                onClick={() =>
                  void resource.runAction("save", {
                    intervalMinutes,
                    analysisTimeframe,
                    strategyMode,
                    market,
                    autoExecute,
                  })
                }
              >
                保存
              </button>
              <button className="button button--secondary" type="button" onClick={() => void resource.runAction("reset", { initialCash })}>
                重置
              </button>
              <span className="toolbar__spacer" />
              <button className="button button--secondary" type="button" onClick={() => void resource.runAction("stop")}>
                停止模拟
              </button>
              <button
                className="button button--primary button--hero"
                type="button"
                onClick={() =>
                  void resource.runAction("start", {
                    intervalMinutes,
                    analysisTimeframe,
                    strategyMode,
                    market,
                    autoExecute,
                  })
                }
              >
                启动模拟
              </button>
            </div>
          </WorkbenchCard>

          <StrategyNarrativeCard
            title="策略解释"
            summary="量化模拟围绕共享候选池展开，当前以 30m 粒度、自动策略和自动执行状态持续运行。"
            recommendation="建议继续观察执行中心里的 BUY / SELL 跳转，若仓位不足一手会按规则直接提示跳过。"
            reasons={[
              `策略模式 ${snapshot.config.strategyMode}`,
              `分析粒度 ${snapshot.config.timeframe}`,
              `自动执行 ${snapshot.config.autoExecute}`,
              `候选数量 ${snapshot.status.candidateCount}`,
            ]}
            evidence={[
              { label: "间隔", value: snapshot.config.interval },
              { label: "市场", value: snapshot.config.market },
              { label: "初始资金", value: snapshot.config.initialCapital },
              { label: "最近执行", value: snapshot.status.lastRun },
              { label: "下次执行", value: snapshot.status.nextRun },
            ]}
          />

          <WorkbenchCard>
            <h2 className="section-card__title">运行状态</h2>
            <p className="section-card__description">这里展示当前定时任务的运行状态和关键参数。</p>
            <div className="mini-metric-grid">
              <div className="mini-metric">
                <div className="mini-metric__label">定时状态</div>
                <div className="mini-metric__value">{snapshot.status.running}</div>
              </div>
              <div className="mini-metric">
                <div className="mini-metric__label">最近执行</div>
                <div className="mini-metric__value">{snapshot.status.lastRun}</div>
              </div>
              <div className="mini-metric">
                <div className="mini-metric__label">下次执行</div>
                <div className="mini-metric__value">{snapshot.status.nextRun}</div>
              </div>
            </div>
          </WorkbenchCard>
        </div>

        <div className="stack">
          <div className="metric-grid">
            {snapshot.metrics.map((metric) => (
              <WorkbenchCard className="metric-card" key={metric.label}>
                <div className="metric-card__label">{metric.label}</div>
                <div className="metric-card__value">{metric.value}</div>
              </WorkbenchCard>
            ))}
          </div>

          <QuantTableSectionCard
            title="量化候选池"
            description="候选池由“我的关注”人工推进到这里，再进入量化模拟和历史回放。"
            table={snapshot.candidatePool}
            emptyTitle={snapshot.candidatePool.emptyLabel ?? "候选池暂无数据"}
            emptyDescription={
              snapshot.candidatePool.emptyMessage ?? "先从我的关注加入股票，或者等待定时任务把新的候选推进到这里。"
            }
            meta={[`表内 ${snapshot.candidatePool.rows.length} 只`, `待量化 ${candidateCount}`]}
            actionsHead="操作"
            toolbar={
              <button
                className="button button--secondary"
                type="button"
                onClick={() => void resource.runAction("bulk-quant", { codes: candidateCodes })}
                disabled={candidateCodes.length === 0}
              >
                批量量化候选池
              </button>
            }
            onRowAction={(row, action) => {
              void resource.runAction(action.action ?? "analyze-candidate", row.id);
            }}
          />

          <WorkbenchCard>
            <h2 className="section-card__title">{snapshot.executionCenter.title}</h2>
            <p className="section-card__description">{snapshot.executionCenter.body}</p>
            <div className="chip-row">
              {snapshot.executionCenter.chips.map((chip) => (
                <span className="chip chip--active" key={chip}>
                  {chip}
                </span>
              ))}
            </div>
            {snapshot.pendingSignals.length > 0 ? (
              <div className="summary-list" style={{ marginTop: "16px" }}>
                {snapshot.pendingSignals.map((item) => (
                  <div className="summary-item" key={item.title}>
                    <div className="summary-item__title">{item.title}</div>
                    <div className="summary-item__body">{item.body}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="summary-item summary-item--accent" style={{ marginTop: "16px" }}>
                <div className="summary-item__title">暂无待执行信号</div>
                <div className="summary-item__body">当前没有新的 BUY / SELL 信号，系统会继续观察候选池并等待下一轮调度。</div>
              </div>
            )}
          </WorkbenchCard>

          <WorkbenchCard>
            <h2 className="section-card__title">账户结果</h2>
            <div className="mini-metric-grid">
              {snapshot.metrics.slice(0, 3).map((metric) => (
                <div className="mini-metric" key={`account-${metric.label}`}>
                  <div className="mini-metric__label">{metric.label}</div>
                  <div className="mini-metric__value">{metric.value}</div>
                </div>
              ))}
            </div>
            <div className="card-divider" />
            <h3 className="section-card__title" style={{ fontSize: "1.2rem" }}>
              权益曲线
            </h3>
            <Sparkline points={snapshot.curve} />
          </WorkbenchCard>

          <div className="section-grid">
            <QuantTableSectionCard
              title="当前持仓"
              table={snapshot.holdings}
              emptyTitle={snapshot.holdings.emptyLabel ?? "当前持仓暂无数据"}
              emptyDescription={snapshot.holdings.emptyMessage ?? "模拟账户当前还没有形成持仓，待下一轮信号触发后会在这里补充。"}
            />
            <QuantTableSectionCard
              title="成交记录"
              table={snapshot.trades}
              emptyTitle={snapshot.trades.emptyLabel ?? "成交记录暂无数据"}
              emptyDescription={snapshot.trades.emptyMessage ?? "如果调度还没有生成新的成交，这里会先保持为空。"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
