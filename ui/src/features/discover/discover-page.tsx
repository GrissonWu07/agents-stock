import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiClient } from "../../lib/api-client";
import { IconButton } from "../../components/ui/icon-button";
import { PageHeader } from "../../components/ui/page-header";
import { WorkbenchCard } from "../../components/ui/workbench-card";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../../components/ui/page-state";
import { usePageData } from "../../lib/use-page-data";
import { useSelection } from "../../lib/use-selection";

type DiscoverPageProps = {
  client?: ApiClient;
};

export function DiscoverPage({ client }: DiscoverPageProps) {
  const resource = usePageData("discover", client);
  const [search, setSearch] = useState("");
  const [batching, setBatching] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const snapshot = resource.data;
  const searchTerm = search.trim();
  const normalizedSearch = searchTerm.toLowerCase();
  const sourceRows = snapshot?.candidateTable.rows ?? [];
  const filteredRows = useMemo(
    () =>
      sourceRows.filter((row) => {
        const text = [row.id, row.reason ?? "", ...row.cells, ...(row.badges ?? [])].join(" ").toLowerCase();
        return text.includes(normalizedSearch);
      }),
    [normalizedSearch, sourceRows],
  );
  const rowIds = useMemo(() => filteredRows.map((row) => row.id), [filteredRows]);
  const selection = useSelection(rowIds);
  const selectedRows = filteredRows.filter((row) => selection.isSelected(row.id));
  const selectedCodes = selectedRows.map((row) => row.id);
  const canBatchWatchlist = selectedCodes.length > 0;
  const selectionPreview = selectedRows.slice(0, 3);
  const selectedPreviewLabel =
    selection.selectedCount > 0
      ? `${selection.selectedCount} 只股票已选中，支持直接批量加入我的关注。`
      : "先勾选候选股票，再统一加入我的关注池。";
  const candidateEmptyLabel = normalizedSearch
    ? `未找到匹配“${searchTerm}”的候选股票`
    : snapshot?.candidateTable.emptyLabel ?? "暂无候选股票";
  const candidateEmptyMessage =
    normalizedSearch && snapshot
      ? "可以尝试输入代码、名称、行业、来源或理由重新筛选。"
      : snapshot?.candidateTable.emptyMessage;

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

  const currentSelectionSummary = selectionPreview.length
    ? selectionPreview.map((row) => `${row.cells[1] ?? row.id} · ${row.cells[0]} · ${row.cells[3] ?? row.source ?? "未知来源"}`)
    : [];

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selection.someSelected;
    }
  }, [selection.someSelected]);

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
          <>
            <button className="button button--secondary" type="button" onClick={() => void resource.runAction("run-strategy")}>
              运行策略
            </button>
            <button className="button button--primary" type="button" onClick={() => void handleBatchWatchlist()} disabled={!canBatchWatchlist || batching}>
              批量加入关注池
            </button>
          </>
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
          <div className="section-grid section-grid--three">
            {snapshot.strategies.map((strategy) => (
              <div className="summary-item" key={strategy.name}>
                <div className="summary-item__title">{strategy.name}</div>
                <div className="summary-item__body">{strategy.note}</div>
                <div className="card-divider" />
                <div className="chip-row">
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
                结果页支持勾选后批量加入我的关注，并保留策略来源，方便后续推进到量化候选池。
              </p>
            </div>
            <span className="toolbar__spacer" />
            <label className="field" style={{ minWidth: "260px" }}>
              <span className="field__label">搜索候选</span>
              <input
                className="input"
                placeholder="输入代码、名称、行业、来源或理由"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <span className="badge badge--neutral">候选 {filteredRows.length} 只</span>
            <span className="badge badge--accent">已选 {selection.selectedCount} 只</span>
          </div>
          <div className="toolbar" style={{ marginTop: "10px" }}>
            <IconButton icon="↻" label="刷新发现结果" tone="neutral" onClick={() => void resource.runAction("run-strategy")} />
            <IconButton
              icon="⭐"
              label="批量加入关注池"
              tone="accent"
              onClick={() => void handleBatchWatchlist()}
              disabled={!canBatchWatchlist || batching}
            />
            <IconButton icon="✕" label="清空选择" tone="neutral" onClick={selection.clear} />
            <span className="toolbar__status">已选 {selection.selectedCount} 只股票</span>
          </div>
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
                  {snapshot.candidateTable.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                  <th className="table__actions-head">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="table__empty" colSpan={snapshot.candidateTable.columns.length + 2}>
                      <div className="summary-item">
                        <div className="summary-item__title">{candidateEmptyLabel}</div>
                        {candidateEmptyMessage ? <div className="summary-item__body">{candidateEmptyMessage}</div> : null}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
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
                      <td>
                        <div className="table__actions">
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
        </WorkbenchCard>

        <div className="section-grid">
          <WorkbenchCard>
            <h2 className="section-card__title">最近结果摘要</h2>
            <p className="section-card__description">{snapshot.summary.body}</p>
            <div className="summary-list">
              <div className="summary-item">
                <div className="summary-item__title">{snapshot.recommendation.title}</div>
                <div className="summary-item__body">{snapshot.recommendation.body}</div>
              </div>
            </div>
            <div className="chip-row">
              {snapshot.recommendation.chips.map((chip) => (
                <span className="chip chip--active" key={chip}>
                  {chip}
                </span>
              ))}
            </div>
            <div className="card-divider" />
            <div className="summary-item__body">快照更新时间：{snapshot.updatedAt}</div>
          </WorkbenchCard>
          <WorkbenchCard>
            <h2 className="section-card__title">当前选择</h2>
            <p className="section-card__description">勾选后可以直接批量加入我的关注，单条动作则沿用表格里的快捷取消/添加入口。</p>
            <div className="summary-list">
              <div className="summary-item">
                <div className="summary-item__title">当前选择摘要</div>
                <div className="summary-item__body">
                  {selectedRows.length > 0 ? selectedPreviewLabel : "主力选股已经生成候选股票，用户可以单只或批量加入我的关注，再决定是否进入量化候选池。"}
                </div>
                {currentSelectionSummary.length > 0 ? (
                  <div className="chip-row" style={{ marginTop: "10px" }}>
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
