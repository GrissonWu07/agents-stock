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
  onClearSelection: () => void;
  onRemoveWatchlist: (code: string) => void;
  onAnalyzeWatchlist: (code: string) => void;
};

const panelStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};

const toolbarCountStyle: React.CSSProperties = {
  color: "var(--text-soft)",
  fontSize: "0.9rem",
  fontWeight: 600,
};

const inputRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "12px",
  alignItems: "end",
};

export function WatchlistPanel({
  watchlist,
  quantCount,
  refreshHint,
  onAddWatchlist,
  onRefresh,
  onBatchQuant,
  onClearSelection,
  onRemoveWatchlist,
  onAnalyzeWatchlist,
}: WatchlistPanelProps) {
  const [symbol, setSymbol] = useState("");
  const rowIds = useMemo(() => watchlist.rows.map((row) => row.id), [watchlist.rows]);
  const selection = useSelection(rowIds);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selection.someSelected;
    }
  }, [selection.someSelected]);

  const selectedCodes = selection.selectedIds;
  const selectedRows = watchlist.rows.filter((row) => selectedCodes.includes(row.id));

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

        <p className="table__caption">{refreshHint}</p>

        <div style={toolbarStyle}>
          <IconButton icon="↻" label="刷新报价" tone="neutral" onClick={onRefresh} />
          <IconButton
            icon="🧪"
            label="加入量化候选"
            tone="accent"
            onClick={handleBatchQuant}
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
          <span style={toolbarCountStyle}>已选 {selectedCodes.length} 只股票</span>
          <span className="badge badge--neutral">量化候选 {quantCount}</span>
        </div>

        <div className="table-shell">
          <table className="table">
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
                {watchlist.rows.length === 0 ? (
                <tr>
                  <td className="table__empty" colSpan={watchlist.columns.length + 2}>
                    {watchlist.emptyLabel ?? "暂无关注股票，请先从工作台、发现股票或研究情报加入。"}
                  </td>
                </tr>
              ) : (
                watchlist.rows.map((row) => {
                  const isSelected = selection.isSelected(row.id);
                  return (
                    <tr key={row.id} className={isSelected ? "table__row--selected" : undefined}>
                      <td className="table__checkbox-cell">
                        <input
                          type="checkbox"
                          aria-label={`选择 ${row.cells[1] ?? row.id}`}
                          checked={isSelected}
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
                          <IconButton
                            icon="🔎"
                            label={`分析 ${row.id}`}
                            tone="accent"
                            onClick={() => onAnalyzeWatchlist(row.id)}
                          />
                          <IconButton
                            icon="🧪"
                            label={`加入量化候选 ${row.id}`}
                            tone="neutral"
                            onClick={() => onBatchQuant([row.id])}
                          />
                          <IconButton
                            icon="🗑"
                            label={`删除 ${row.id}`}
                            tone="danger"
                            onClick={() => onRemoveWatchlist(row.id)}
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
