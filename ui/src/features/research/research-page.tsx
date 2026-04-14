import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiClient } from "../../lib/api-client";
import { IconButton } from "../../components/ui/icon-button";
import { PageHeader } from "../../components/ui/page-header";
import { WorkbenchCard } from "../../components/ui/workbench-card";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../../components/ui/page-state";
import { usePageData } from "../../lib/use-page-data";
import { useSelection } from "../../lib/use-selection";

type ResearchPageProps = {
  client?: ApiClient;
};

export function ResearchPage({ client }: ResearchPageProps) {
  const resource = usePageData("research", client);
  const [search, setSearch] = useState("");
  const [batching, setBatching] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const snapshot = resource.data;
  const searchTerm = search.trim();
  const normalizedSearch = searchTerm.toLowerCase();
  const sourceRows = snapshot?.outputTable.rows ?? [];
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
  const selectedPreview = selectedRows.slice(0, 3);
  const selectedPreviewLabel =
    selection.selectedCount > 0
      ? `${selection.selectedCount} 只股票已选中，支持直接批量加入我的关注。`
      : "先勾选股票输出，再统一加入我的关注池。";
  const outputEmptyLabel = normalizedSearch
    ? `未找到匹配“${searchTerm}”的股票输出`
    : snapshot?.outputTable.emptyLabel ?? "暂无股票输出";
  const outputEmptyMessage =
    normalizedSearch && snapshot
      ? "可以尝试输入代码、名称、来源模块或后续动作重新筛选。"
      : snapshot?.outputTable.emptyMessage;

  const derivedMetrics = snapshot
    ? [
        { label: "情报模块", value: String(snapshot.modules.length) },
        { label: "股票输出", value: String(snapshot.outputTable.rows.length) },
        { label: "市场判断", value: String(snapshot.marketView.length) },
        { label: "最近更新", value: snapshot.updatedAt || "--" },
      ]
    : [];

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

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selection.someSelected;
    }
  }, [selection.someSelected]);

  if (resource.status === "loading" && !snapshot) {
    return <PageLoadingState title="研究情报加载中" description="正在读取板块、龙虎榜、新闻和宏观判断。" />;
  }

  if (resource.status === "error" && !snapshot) {
    return (
      <PageErrorState
        title="研究情报加载失败"
        description={resource.error ?? "无法加载研究情报数据，请稍后重试。"}
        actionLabel="重新加载"
        onAction={resource.refresh}
      />
    );
  }

  if (!snapshot) {
    return <PageEmptyState title="研究情报暂无数据" description="后台尚未返回研究情报快照。" actionLabel="刷新" onAction={resource.refresh} />;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Research"
        title="研究情报"
        description="把智策板块、智瞰龙虎、新闻流量、宏观分析和宏观周期统一收在一个聚合页里。有股票输出时再加入我的关注。"
        actions={
          <>
            <button className="button button--secondary" type="button" onClick={() => void resource.runAction("run-module")}>
              重新生成
            </button>
            <button className="button button--primary" type="button" onClick={() => void handleBatchWatchlist()} disabled={!canBatchWatchlist || batching}>
              批量加入关注池
            </button>
          </>
        }
      />
      <div className="stack">
        <div className="metric-grid">
          {derivedMetrics.map((metric) => (
            <WorkbenchCard className="metric-card" key={metric.label}>
              <div className="metric-card__label">{metric.label}</div>
              <div className="metric-card__value">{metric.value}</div>
            </WorkbenchCard>
          ))}
        </div>

        <WorkbenchCard>
          <h2 className="section-card__title">情报模块</h2>
          <p className="section-card__description">{snapshot.summary.title}</p>
          <div className="section-grid section-grid--three">
            {snapshot.modules.map((module) => (
              <div className="summary-item" key={module.name}>
                <div className="summary-item__title">{module.name}</div>
                <div className="summary-item__body">{module.note}</div>
                <div className="card-divider" />
                <span className="badge badge--neutral">{module.output}</span>
              </div>
            ))}
          </div>
        </WorkbenchCard>

        <div className="section-grid section-grid--sidebar">
          <WorkbenchCard>
            <h2 className="section-card__title">市场判断</h2>
            <div className="summary-list">
              {snapshot.marketView.map((item) => (
                <div className="summary-item" key={item.title}>
                  <div className="summary-item__title">{item.title}</div>
                  <div className="summary-item__body">{item.body}</div>
                </div>
              ))}
            </div>
          </WorkbenchCard>
          <WorkbenchCard>
            <h2 className="section-card__title">研究结论</h2>
            <p className="section-card__description">{snapshot.summary.body}</p>
            <div className="summary-list">
              <div className="summary-item">
                <div className="summary-item__title">结论摘要</div>
                <div className="summary-item__body">{snapshot.summary.title}</div>
              </div>
            </div>
          </WorkbenchCard>
        </div>

        <WorkbenchCard>
          <div className="toolbar">
            <div>
              <h2 className="section-card__title" style={{ margin: 0 }}>
                股票输出
              </h2>
              <p className="table__caption" style={{ marginBottom: 0 }}>
                只有研究模块明确输出股票时，才会出现加入我的关注的操作。
              </p>
            </div>
            <span className="toolbar__spacer" />
            <label className="field" style={{ minWidth: "260px" }}>
              <span className="field__label">搜索输出</span>
              <input
                className="input"
                placeholder="输入代码、名称、来源或原因"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <span className="badge badge--neutral">输出 {filteredRows.length} 只</span>
            <span className="badge badge--accent">已选 {selection.selectedCount} 只</span>
          </div>
          <div className="toolbar" style={{ marginTop: "10px" }}>
            <IconButton icon="↻" label="刷新研究情报" tone="neutral" onClick={() => void resource.runAction("run-module")} />
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
                      aria-label="全选当前研究输出"
                      checked={selection.allSelected}
                      onChange={selection.toggleAll}
                    />
                  </th>
                  {snapshot.outputTable.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                  <th className="table__actions-head">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="table__empty" colSpan={snapshot.outputTable.columns.length + 2}>
                      <div className="summary-item">
                        <div className="summary-item__title">{outputEmptyLabel}</div>
                        {outputEmptyMessage ? <div className="summary-item__body">{outputEmptyMessage}</div> : null}
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

        <WorkbenchCard>
          <h2 className="section-card__title">最近结果摘要</h2>
          <p className="section-card__description">{snapshot.summary.body}</p>
          <div className="summary-list">
            <div className="summary-item">
              <div className="summary-item__title">{snapshot.summary.title}</div>
              <div className="summary-item__body">快照更新时间：{snapshot.updatedAt}</div>
            </div>
          </div>
          <div className="chip-row">
            {snapshot.modules.map((module) => (
              <span className="badge badge--neutral" key={module.name}>
                {module.name} · {module.output}
              </span>
            ))}
          </div>
          <div className="card-divider" />
          <div className="summary-list">
            <div className="summary-item">
              <div className="summary-item__title">当前选择与回写</div>
              <div className="summary-item__body">
                {selectedRows.length > 0 ? selectedPreviewLabel : "研究模块默认展示市场判断，只有明确股票输出时才允许加入我的关注。"}
              </div>
              {selectedPreview.length > 0 ? (
                <div className="chip-row" style={{ marginTop: "10px" }}>
                  {selectedPreview.map((row) => (
                    <span className="badge badge--neutral" key={row.id}>
                      {row.cells[1] ?? row.id} · {row.cells[2] ?? row.source ?? "来源未标注"}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </WorkbenchCard>
      </div>
    </div>
  );
}
