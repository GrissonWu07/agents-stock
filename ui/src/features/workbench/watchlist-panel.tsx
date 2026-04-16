import { useEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "../../components/ui/icon-button";
import { WorkbenchCard } from "../../components/ui/workbench-card";
import type { TableSection } from "../../lib/page-models";
import { useSelection } from "../../lib/use-selection";

type WatchlistPanelProps = {
  watchlist: TableSection;
  quantCount: number;
  refreshHint: string;
  onAddWatchlist: (code: string) => void;
  onRefresh: () => void;
  onBatchQuant: (codes: string[]) => void;
  onBatchAnalyzeInput: (codes: string[]) => void;
  onClearSelection: () => void;
  onRemoveWatchlist: (code: string) => void;
  onAnalyzeWatchlist: (code: string) => void;
};

const panelStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
};

const inputRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "12px",
  alignItems: "end",
};

const PAGE_SIZE = 50;

export function WatchlistPanel({
  watchlist,
  quantCount,
  refreshHint,
  onAddWatchlist,
  onRefresh,
  onBatchQuant,
  onBatchAnalyzeInput,
  onClearSelection,
  onRemoveWatchlist,
  onAnalyzeWatchlist,
}: WatchlistPanelProps) {
  const [symbol, setSymbol] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!normalizedSearch) return watchlist.rows;
    return watchlist.rows.filter((row) =>
      row.cells.some((cell) => String(cell).toLowerCase().includes(normalizedSearch)) ||
      row.id.toLowerCase().includes(normalizedSearch) ||
      (row.code ?? "").toLowerCase().includes(normalizedSearch) ||
      (row.name ?? "").toLowerCase().includes(normalizedSearch) ||
      (row.source ?? "").toLowerCase().includes(normalizedSearch),
    );
  }, [normalizedSearch, watchlist.rows]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, filteredRows],
  );
  const rowIds = useMemo(() => pageRows.map((row) => row.id), [pageRows]);
  const selection = useSelection(rowIds);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selection.someSelected;
    }
  }, [selection.someSelected]);

  useEffect(() => {
    setPage(1);
  }, [normalizedSearch]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const selectedCodes = selection.selectedIds;
  const selectedRows = pageRows.filter((row) => selectedCodes.includes(row.id));

  const handleAdd = () => {
    const value = symbol.trim();
    if (!value) return;
    onAddWatchlist(value);
    setSymbol("");
  };

  const handleBatchQuant = () => {
    if (selectedCodes.length > 0) {
      onBatchQuant(selectedCodes);
    }
  };

  const handleBatchAnalyzeInput = () => {
    if (selectedCodes.length > 0) {
      onBatchAnalyzeInput(selectedCodes);
    }
  };

  return (
    <WorkbenchCard>
      <div style={panelStyle}>
        <div>
          <h2 className="section-card__title">我的关注</h2>
          <p className="section-card__description">
            先看你真正关心的股票。来自发现股票和研究情报的结果都会汇总到这里，再继续推进到股票分析和量化候选池。
          </p>
        </div>

        <div style={inputRowStyle}>
          <label className="field">
            <span className="field__label">股票代码</span>
            <input
              className="input"
              placeholder="例如 600519 / 300390 / AAPL"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAdd();
                }
              }}
            />
          </label>
          <button className="button button--primary" type="button" onClick={handleAdd} disabled={!symbol.trim()}>
            添加
          </button>
        </div>

        <div className="watchlist-search-row">
          <label className="field watchlist-search-field">
            <span className="field__label">搜索股票</span>
            <input
              className="input"
              placeholder="按代码、名称、来源或状态搜索"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="watchlist-search-meta">
            <span className="badge badge--neutral">共 {filteredRows.length} 只</span>
            <span className="watchlist-search-meta__hint">
              {filteredRows.length === 0
                ? "没有匹配结果"
                : `第 ${Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredRows.length)} - ${Math.min(
                    currentPage * PAGE_SIZE,
                    filteredRows.length,
                  )} 条`}
            </span>
          </div>
        </div>

        <p className="table__caption">{refreshHint}</p>

        <div className="watchlist-toolbar" data-testid="watchlist-toolbar">
          <div className="watchlist-toolbar__cluster" data-testid="watchlist-toolbar-cluster">
            <div className="watchlist-toolbar__actions" data-testid="watchlist-toolbar-actions">
              <IconButton icon="↻" label="刷新报价" tone="neutral" onClick={onRefresh} />
              <IconButton
                icon="🧪"
                label="加入量化候选"
                tone="accent"
                onClick={handleBatchQuant}
                disabled={selectedCodes.length === 0}
              />
              <IconButton
                icon="🔎"
                label="加入分析输入"
                tone="accent"
                onClick={handleBatchAnalyzeInput}
                disabled={selectedCodes.length === 0}
              />
              <IconButton
                icon="✕"
                label="清空选择"
                tone="neutral"
                onClick={() => {
                  selection.clear();
                  onClearSelection();
                }}
              />
            </div>
            <div className="watchlist-toolbar__status" data-testid="watchlist-toolbar-status">
              <span className="watchlist-toolbar__count">已选 {selectedCodes.length} 只股票</span>
              <span className="badge badge--neutral">量化候选 {quantCount}</span>
            </div>
          </div>
        </div>

        <div className="table-shell watchlist-table-shell">
          <div className="watchlist-table__viewport">
            <table className="table watchlist-table" data-testid="watchlist-table">
            <colgroup>
              <col className="watchlist-table__col watchlist-table__col--checkbox" />
              <col className="watchlist-table__col watchlist-table__col--code" />
              <col className="watchlist-table__col watchlist-table__col--name" />
              <col className="watchlist-table__col watchlist-table__col--price" />
              <col className="watchlist-table__col watchlist-table__col--source" />
              <col className="watchlist-table__col watchlist-table__col--status" />
              <col className="watchlist-table__col watchlist-table__col--quant" />
              <col className="watchlist-table__col watchlist-table__col--actions" />
            </colgroup>
            <thead>
              <tr>
                <th className="table__checkbox-cell">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label="全选当前关注股票"
                    checked={selection.allSelected}
                    onChange={selection.toggleAll}
                  />
                </th>
                {watchlist.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              <th className="table__actions-head">操作</th>
            </tr>
          </thead>
          <tbody>
                {pageRows.length === 0 ? (
                <tr>
                  <td className="table__empty" colSpan={watchlist.columns.length + 2}>
                    {filteredRows.length === 0
                      ? watchlist.emptyLabel ?? "暂无关注股票，请先从工作台、发现股票或研究情报加入。"
                      : "当前页没有股票，请切换分页或调整搜索条件。"}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const isSelected = selection.isSelected(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={isSelected ? "table__row--selected" : undefined}
                      onClick={() => selection.toggle(row.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="table__checkbox-cell">
                        <input
                          type="checkbox"
                          aria-label={`选择 ${row.cells[1] ?? row.id}`}
                          checked={isSelected}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => selection.toggle(row.id)}
                        />
                      </td>
                      {row.cells.map((cell, index) => (
                        <td key={`${row.id}-${index}`} className={index === 0 ? "table__cell-strong" : undefined}>
                          {cell}
                        </td>
                      ))}
                      <td className="table__actions-cell">
                        <div className="table__actions">
                          <IconButton
                            icon="🔎"
                            label={`分析 ${row.id}`}
                            tone="accent"
                            onClick={(event) => {
                              event.stopPropagation();
                              onAnalyzeWatchlist(row.id);
                            }}
                          />
                          <IconButton
                            icon="🧪"
                            label={`加入量化候选 ${row.id}`}
                            tone="neutral"
                            onClick={(event) => {
                              event.stopPropagation();
                              onBatchQuant([row.id]);
                            }}
                          />
                          <IconButton
                            icon="🗑"
                            label={`删除 ${row.id}`}
                            tone="danger"
                            onClick={(event) => {
                              event.stopPropagation();
                              onRemoveWatchlist(row.id);
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
          </tbody>
            </table>
          </div>
        </div>
        <div className="watchlist-pagination" data-testid="watchlist-pagination">
          <div className="watchlist-pagination__summary">
            <span className="watchlist-pagination__count">
              共 {filteredRows.length} 只，当前第 {currentPage} / {pageCount} 页
            </span>
          </div>
          <div className="watchlist-pagination__controls">
            <button
              className="button"
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
            >
              上一页
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
              <button
                key={number}
                className={`button watchlist-pagination__page${number === currentPage ? " watchlist-pagination__page--active" : ""}`}
                type="button"
                onClick={() => setPage(number)}
                aria-current={number === currentPage ? "page" : undefined}
              >
                {number}
              </button>
            ))}
            <button
              className="button"
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={currentPage === pageCount}
            >
              下一页
            </button>
          </div>
        </div>
        {selectedRows.length > 0 ? (
          <div className="summary-item summary-item--accent">
            <div className="summary-item__title">当前选择</div>
            <div className="summary-item__body">
              {selectedRows.map((row) => `${row.cells[0]} ${row.cells[1]} · ${row.cells[3]}`).join("、")}
            </div>
          </div>
        ) : null}
      </div>
    </WorkbenchCard>
  );
}
