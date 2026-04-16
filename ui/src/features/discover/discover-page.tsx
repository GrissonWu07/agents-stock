import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiClient } from "../../lib/api-client";
import { IconButton } from "../../components/ui/icon-button";
import { PageHeader } from "../../components/ui/page-header";
import { WorkbenchCard } from "../../components/ui/workbench-card";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../../components/ui/page-state";
import { usePageData } from "../../lib/use-page-data";
import { useSelection } from "../../lib/use-selection";
import type { WorkbenchSnapshot } from "../../lib/page-models";

type DiscoverPageProps = {
  client?: ApiClient;
};

export function DiscoverPage({ client }: DiscoverPageProps) {
  const resource = usePageData("discover", client);
  const [search, setSearch] = useState("");
  const [batching, setBatching] = useState(false);
  const [runningStrategy, setRunningStrategy] = useState(false);
  const [runFeedback, setRunFeedback] = useState<string>("");
  const [analysisFeedback, setAnalysisFeedback] = useState<string>("");
  const [analysisSnapshot, setAnalysisSnapshot] = useState<WorkbenchSnapshot["analysis"] | null>(null);
  const [analyzingCode, setAnalyzingCode] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(0);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const analysisPanelRef = useRef<HTMLElement | null>(null);
  const pageSize = 6;

  const snapshot = resource.data;
  const searchTerm = search.trim();
  const normalizedSearch = searchTerm.toLowerCase();
  const sourceRows = snapshot?.candidateTable.rows ?? [];
  const candidateColumnsFromBackend = snapshot?.candidateTable.columns ?? [];
  const hasBackendSelectedAtColumn = candidateColumnsFromBackend.includes("发现时间");
  const getRowSelectedAt = (row: (typeof sourceRows)[number]) => {
    const rawSelectedAt = row.selectedAt;
    const rawLegacySelectedAt = (row as Record<string, unknown>).selected_at;
    if (typeof rawSelectedAt === "string" && rawSelectedAt.trim()) {
      return rawSelectedAt.trim();
    }
    if (typeof rawLegacySelectedAt === "string" && rawLegacySelectedAt.trim()) {
      return rawLegacySelectedAt.trim();
    }
    if (row.cells.length >= 9 && typeof row.cells[8] === "string" && row.cells[8].trim()) {
      return row.cells[8].trim();
    }
    return "";
  };
  const showSelectedAtColumn = sourceRows.length > 0 && !hasBackendSelectedAtColumn;
  const candidateColumns = useMemo(
    () => (showSelectedAtColumn ? [...candidateColumnsFromBackend, "发现时间"] : candidateColumnsFromBackend),
    [candidateColumnsFromBackend, showSelectedAtColumn],
  );
  const filteredRows = useMemo(
    () =>
      sourceRows.filter((row) => {
        const text = [
          row.id,
          row.reason ?? "",
          ...row.cells,
          getRowSelectedAt(row),
          ...(row.badges ?? []),
        ].join(" ").toLowerCase();
        return text.includes(normalizedSearch);
      }),
    [normalizedSearch, sourceRows],
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = useMemo(
    () => filteredRows.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [currentPage, filteredRows],
  );
  const rowIds = useMemo(() => visibleRows.map((row) => row.id), [visibleRows]);
  const selection = useSelection(rowIds);
  const selectedRows = visibleRows.filter((row) => selection.isSelected(row.id));
  const selectedCodes = selectedRows.map((row) => row.id);
  const canBatchWatchlist = selectedCodes.length > 0;
  const discoverAnalystViews = analysisSnapshot?.analystViews ?? analysisSnapshot?.insights.filter((item) => item.title.includes("分析师")) ?? [];
  const discoverDecisionInsights = analysisSnapshot?.insights.filter((item) => !item.title.includes("分析师")) ?? [];
  const selectionPreview = selectedRows.slice(0, 3);
  const selectedPreviewLabel =
    selection.selectedCount > 0
      ? `${selection.selectedCount} 只股票已选中，可在表格下方统一加入我的关注。`
      : `当前未选择候选股票。可从 ${filteredRows.length} 只候选里先勾选，再统一加入我的关注。`;
  const candidateEmptyLabel = normalizedSearch
    ? `未找到匹配“${searchTerm}”的候选股票`
    : snapshot?.candidateTable.emptyLabel ?? "暂无候选股票";
  const candidateEmptyMessage =
    normalizedSearch && snapshot
      ? "可以尝试输入代码、名称、行业、来源或理由重新筛选。"
      : snapshot?.candidateTable.emptyMessage;
  const currentPageLabel = `当前第 ${Math.min(currentPage + 1, totalPages)} / ${totalPages} 页`;

  const handleBatchWatchlist = async () => {
    if (!canBatchWatchlist || batching) return;
    setBatching(true);
    try {
      await resource.runAction("batch-watchlist", { codes: selectedCodes });
      selection.clear();
    } finally {
      setBatching(false);
    }
  };

  const handleSingleWatchlist = (code: string) => {
    void resource.runAction("item-watchlist", { code });
  };

  const handleAnalyzeCandidate = async (code: string) => {
    if (analyzingCode || !client) return;
    setAnalyzingCode(code);
    setAnalysisFeedback(`正在分析 ${code}...`);
    try {
      const result = (await client.runPageAction("workbench", "analysis", { stockCode: code })) as {
        analysis?: WorkbenchSnapshot["analysis"];
      };
      if (result.analysis) {
        setAnalysisSnapshot(result.analysis);
        setAnalysisFeedback(`已完成 ${code} 的分析，可在下方查看摘要、指标和结论。`);
        window.requestAnimationFrame(() => {
          if (typeof analysisPanelRef.current?.scrollIntoView === "function") {
            analysisPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      } else {
        setAnalysisFeedback(`已发起 ${code} 的分析，但暂未返回分析结果。`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAnalysisFeedback(`分析失败：${message}`);
    } finally {
      setAnalyzingCode("");
    }
  };

  const handleRunStrategy = async () => {
    if (runningStrategy) return;
    setRunningStrategy(true);
    setRunFeedback("正在刷新发现结果...");
    try {
      await resource.runAction("run-strategy");
      setRunFeedback("发现结果已更新，候选与摘要已同步刷新。");
    } finally {
      setRunningStrategy(false);
    }
  };

  const currentSelectionSummary = selectionPreview.length
    ? selectionPreview.map((row) => `${row.cells[1] ?? row.id} · ${row.cells[0]} · ${row.cells[3] ?? row.source ?? "未知来源"}`)
    : [];

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selection.someSelected;
    }
  }, [selection.someSelected]);

  useEffect(() => {
    setCurrentPage(0);
  }, [normalizedSearch]);

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

  if (resource.status === "loading" && !snapshot) {
    return <PageLoadingState title="发现股票加载中" description="正在获取策略、候选股票和最近推荐结果。" />;
  }

  if (resource.status === "error" && !snapshot) {
    return (
      <PageErrorState
        title="发现股票加载失败"
        description={resource.error ?? "无法加载发现股票数据，请稍后重试。"}
        actionLabel="重新加载"
        onAction={resource.refresh}
      />
    );
  }

  if (!snapshot) {
    return <PageEmptyState title="发现股票暂无数据" description="后台尚未返回发现股票快照。" actionLabel="刷新" onAction={resource.refresh} />;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Discover"
        title="发现股票"
        description="把主力选股、低价擒牛、小市值、净利增长和低估值统一收在一个聚合页里。结果统一加入我的关注。"
        actions={
          <button className="button button--primary" type="button" onClick={() => void handleRunStrategy()} disabled={runningStrategy}>
            {runningStrategy ? "运行中..." : "运行策略"}
          </button>
        }
      />
      <div className="stack">
        <div className="metric-grid">
          {snapshot.metrics.map((metric) => (
            <WorkbenchCard className="metric-card" key={metric.label}>
              <div className="metric-card__label">{metric.label}</div>
              <div className="metric-card__value">{metric.value}</div>
            </WorkbenchCard>
          ))}
        </div>

        <WorkbenchCard>
          <div className="toolbar">
            <div>
              <h2 className="section-card__title">发现策略</h2>
              <p className="section-card__description" style={{ marginBottom: 0 }}>
                {snapshot.summary.title}
              </p>
            </div>
            <span className="toolbar__spacer" />
            <div className="chip-row">
              {snapshot.strategies.map((strategy) => (
                <span className="badge badge--neutral" key={strategy.name}>
                  {strategy.name} · {strategy.status}
                </span>
              ))}
            </div>
          </div>
          <div className="section-grid section-grid--three" style={{ marginTop: "8px" }}>
            {snapshot.strategies.map((strategy) => (
              <div className="summary-item" key={strategy.name} style={{ padding: "12px 14px" }}>
                <div className="summary-item__title">{strategy.name}</div>
                <div className="summary-item__body">{strategy.note}</div>
                <div className="card-divider" />
                <div className="chip-row" style={{ gap: "4px", marginTop: "0" }}>
                  <span className="badge badge--neutral">{strategy.status}</span>
                  {strategy.highlight ? <span className="badge badge--success">{strategy.highlight}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </WorkbenchCard>

        <WorkbenchCard>
          <div className="toolbar">
            <div>
              <h2 className="section-card__title" style={{ margin: 0 }}>
                候选股票
              </h2>
              <p className="table__caption" style={{ marginBottom: 0 }}>
                结果页支持逐行分析、勾选后批量加入我的关注，并保留策略来源，方便后续推进到量化候选池。
              </p>
            </div>
          </div>
          <div className="discover-candidate-toolbar" data-testid="discover-candidate-toolbar">
            <div className="discover-candidate-toolbar__search-row">
              <span className="discover-candidate-toolbar__label">搜索候选</span>
              <input
                className="input discover-candidate-toolbar__input"
                placeholder="输入代码、名称、行业、来源、理由或发现时间"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <span className="badge badge--neutral discover-candidate-toolbar__summary">
              已选/候选 {selection.selectedCount} / {filteredRows.length}
            </span>
            <div className="discover-candidate-toolbar__actions">
              <IconButton icon="↻" label="刷新发现结果" tone="neutral" onClick={() => void handleRunStrategy()} disabled={runningStrategy} />
              <IconButton icon="✕" label="清空选择" tone="neutral" onClick={selection.clear} />
            </div>
          </div>
          {runFeedback ? <div className="discover-candidate-toolbar__feedback">{runFeedback}</div> : null}
          <div className="table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th className="table__checkbox-cell">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      aria-label="全选当前发现股票"
                      checked={selection.allSelected}
                      onChange={selection.toggleAll}
                    />
                  </th>
                  {candidateColumns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                  <th className="table__actions-head">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="table__empty" colSpan={candidateColumns.length + 2}>
                      <div className="summary-item">
                        <div className="summary-item__title">{candidateEmptyLabel}</div>
                        {candidateEmptyMessage ? <div className="summary-item__body">{candidateEmptyMessage}</div> : null}
                      </div>
                    </td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td className="table__empty" colSpan={candidateColumns.length + 2}>
                      <div className="summary-item">
                        <div className="summary-item__title">当前页没有候选股票</div>
                        <div className="summary-item__body">你可以切换到上一页或下一页查看其他结果。</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr key={row.id} className={selection.isSelected(row.id) ? "table__row--selected" : undefined}>
                      <td className="table__checkbox-cell">
                        <input
                          type="checkbox"
                          aria-label={`选择 ${row.cells[1] ?? row.id}`}
                          checked={selection.isSelected(row.id)}
                          onChange={() => selection.toggle(row.id)}
                        />
                      </td>
                      {row.cells.map((cell, index) => (
                        <td key={`${row.id}-${index}`} className={index === 0 ? "table__cell-strong" : undefined}>
                          {cell}
                        </td>
                      ))}
                      {showSelectedAtColumn ? (
                        <td key={`${row.id}-selected-at`}>
                          {getRowSelectedAt(row) || "—"}
                        </td>
                      ) : null}
                      <td>
                        <div className="table__actions">
                          <button
                            className="button button--secondary"
                            type="button"
                            onClick={() => void handleAnalyzeCandidate(row.id)}
                            disabled={analyzingCode === row.id}
                          >
                            <span aria-hidden="true">🔎</span>
                            <span>{analyzingCode === row.id ? "分析中" : "分析"}</span>
                          </button>
                          <button className="button button--secondary" type="button" onClick={() => handleSingleWatchlist(row.id)}>
                            <span aria-hidden="true">{row.actions?.[0]?.icon ?? "⭐"}</span>
                            <span>{row.actions?.[0]?.label ?? "加入关注池"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="discover-candidate-footer" data-testid="discover-candidate-footer">
            <div className="discover-candidate-footer__left">
              {filteredRows.length > 0 ? (
                <>
                  <span className="toolbar__status">
                    当前显示 {currentPage * pageSize + 1}-{Math.min(filteredRows.length, currentPage * pageSize + visibleRows.length)} / {filteredRows.length} 只候选股票
                  </span>
                </>
              ) : (
                <span className="toolbar__status">暂无候选股票</span>
              )}
            </div>
            <span className="toolbar__status discover-candidate-footer__page">{currentPageLabel}</span>
            <div className="discover-candidate-footer__actions">
              <button className="button button--primary" type="button" onClick={() => void handleBatchWatchlist()} disabled={!canBatchWatchlist || batching}>
                加入所选关注池
              </button>
              <button className="button button--secondary" type="button" onClick={() => setCurrentPage((current) => Math.max(0, current - 1))} disabled={currentPage === 0}>
                上一页
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setCurrentPage((current) => Math.min(totalPages - 1, current + 1))}
                disabled={currentPage >= totalPages - 1}
              >
                下一页
              </button>
            </div>
          </div>
        </WorkbenchCard>

        <WorkbenchCard className="discover-analysis-panel discover-summary-panel" ref={analysisPanelRef}>
          <div className="toolbar toolbar--compact">
            <div>
              <h2 className="section-card__title" style={{ margin: 0 }}>
                股票分析
              </h2>
              <p className="section-card__description" style={{ marginBottom: 0 }}>
                点击候选表里的“分析”后，这里会展示股票分析摘要、关键指标、最终决策和分析师观点。
              </p>
            </div>
            <span className="toolbar__spacer" />
            {analysisSnapshot ? <span className="badge badge--neutral">分析标的 {analysisSnapshot.symbol || "未知"}</span> : null}
          </div>
          {analysisFeedback ? <div className="discover-candidate-toolbar__feedback">{analysisFeedback}</div> : null}
          {analysisSnapshot ? (
            <>
              <div className="summary-list">
                <div className="summary-item summary-item--accent" style={{ padding: "12px 14px" }}>
                  <div className="summary-item__title">{analysisSnapshot.summaryTitle}</div>
                  <div className="summary-item__body">{analysisSnapshot.summaryBody}</div>
                  {analysisSnapshot.generatedAt ? <div className="summary-item__meta">生成时间：{analysisSnapshot.generatedAt}</div> : null}
                </div>
              </div>
              <div className="mini-metric-grid" style={{ marginTop: "12px" }}>
                {analysisSnapshot.indicators.map((indicator) => (
                  <div className="mini-metric" key={indicator.label}>
                    <div className="mini-metric__label">{indicator.label}</div>
                    <div className="mini-metric__value">{indicator.value}</div>
                  </div>
                ))}
              </div>
              <div className="summary-list" style={{ marginTop: "12px" }}>
                <div className="summary-item" style={{ padding: "12px 14px" }}>
                  <div className="summary-item__title">最终决策</div>
                  <div className="summary-item__body">{analysisSnapshot.finalDecisionText ?? analysisSnapshot.decision}</div>
                </div>
              </div>
              {discoverDecisionInsights.length > 0 ? (
                <div className="summary-list" style={{ marginTop: "12px" }}>
                  {discoverDecisionInsights.map((insight) => (
                    <div className="summary-item" key={insight.title} style={{ padding: "12px 14px" }}>
                      <div className="summary-item__title">{insight.title}</div>
                      <div className="summary-item__body">{insight.body}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {discoverAnalystViews.length > 0 ? (
                <div className="summary-list" style={{ marginTop: "12px" }}>
                  {discoverAnalystViews.map((insight) => (
                    <div className="summary-item" key={insight.title} style={{ padding: "12px 14px" }}>
                      <div className="summary-item__title">{insight.title}</div>
                      <div className="summary-item__body">{insight.body}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="summary-list">
              <div className="summary-item" style={{ padding: "12px 14px" }}>
                <div className="summary-item__title">等待分析结果</div>
                <div className="summary-item__body">
                  点击候选表里的“分析”后，这里会展示股票分析摘要、关键指标、最终决策和分析师观点。
                </div>
              </div>
            </div>
          )}
        </WorkbenchCard>

        <div className="section-grid">
          <WorkbenchCard className="discover-summary-panel">
            <h2 className="section-card__title">最近结果摘要</h2>
            <p className="section-card__description">{snapshot.summary.body}</p>
            <div className="summary-list">
              <div className="summary-item" style={{ padding: "12px 14px" }}>
                <div className="summary-item__title">{snapshot.recommendation.title}</div>
                <div className="summary-item__body">{snapshot.recommendation.body}</div>
              </div>
            </div>
            <div className="chip-row" style={{ gap: "4px" }}>
              {snapshot.recommendation.chips.map((chip) => (
                <span className="chip chip--active" key={chip}>
                  {chip}
                </span>
              ))}
            </div>
            <div className="card-divider" />
            <div className="summary-item__body">快照更新时间：{snapshot.updatedAt}</div>
          </WorkbenchCard>
          <WorkbenchCard className="discover-summary-panel">
            <h2 className="section-card__title">当前选择</h2>
            <p className="section-card__description">勾选后可以直接批量加入我的关注，单条动作则沿用表格里的快捷取消/添加入口。</p>
            <div className="summary-list">
              <div className="summary-item" style={{ padding: "12px 14px" }}>
                <div className="summary-item__title">当前选择摘要</div>
                <div className="summary-item__body">{selectedPreviewLabel}</div>
                <div className="summary-item__body" style={{ marginTop: "4px" }}>
                  需要先看单只股票结论时，可以直接点表格右侧的“分析”，结果会显示在候选表格下方。
                </div>
                {currentSelectionSummary.length > 0 ? (
                  <div className="chip-row" style={{ marginTop: "8px", gap: "4px" }}>
                    {currentSelectionSummary.map((item) => (
                      <span className="badge badge--neutral" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </WorkbenchCard>
        </div>
      </div>
    </div>
  );
}
