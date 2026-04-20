import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ApiClient } from "../../lib/api-client";
import type { PortfolioSnapshot } from "../../lib/page-models";
import { apiClient } from "../../lib/api-client";
import { t } from "../../lib/i18n";
import { PageHeader } from "../../components/ui/page-header";
import { WorkbenchCard } from "../../components/ui/workbench-card";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../../components/ui/page-state";
import { Sparkline } from "../../components/ui/sparkline";

type PositionFormState = {
  quantity: string;
  costPrice: string;
  takeProfit: string;
  stopLoss: string;
};

type PortfolioPositionPageProps = {
  client?: ApiClient;
};

const EMPTY_FORM: PositionFormState = {
  quantity: "",
  costPrice: "",
  takeProfit: "",
  stopLoss: "",
};

export function PortfolioPositionPage({ client = apiClient }: PortfolioPositionPageProps) {
  const { symbol = "" } = useParams<{ symbol: string }>();
  const normalizedSymbol = symbol.trim();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PositionFormState>(EMPTY_FORM);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState<string>("");

  const load = async () => {
    if (!normalizedSymbol) return;
    setStatus("loading");
    setError(null);
    try {
      const response = await client.getPortfolioPosition<PortfolioSnapshot>(normalizedSymbol);
      setSnapshot(response);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  useEffect(() => {
    void load();
  }, [normalizedSymbol]);

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

  const refreshIndicators = async () => {
    if (!normalizedSymbol) return;
    try {
      const response = await client.runPageAction<PortfolioSnapshot>("portfolio", "refresh-indicators", {
        symbols: [normalizedSymbol],
        selectedSymbol: normalizedSymbol,
        scope: "indicators_only",
      });
      setSnapshot(response);
      setStatus("ready");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  const savePosition = async () => {
    if (!normalizedSymbol) return;
    try {
      const response = await client.patchPortfolioPosition<PortfolioSnapshot>(normalizedSymbol, {
        quantity: form.quantity,
        costPrice: form.costPrice,
        takeProfit: form.takeProfit,
        stopLoss: form.stopLoss,
      });
      setSnapshot(response);
      setStatus("ready");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  const runAnalyze = async () => {
    if (!normalizedSymbol || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalyzeStatus(`已开始分析 ${normalizedSymbol}，正在执行中...`);
    try {
      await client.runPageAction<PortfolioSnapshot>("portfolio", "analyze", { code: normalizedSymbol });
      const refreshed = await client.getPortfolioPosition<PortfolioSnapshot>(normalizedSymbol);
      setSnapshot(refreshed);
      setStatus("ready");
      setError(null);
      setAnalyzeStatus(`分析完成：${normalizedSymbol}，详情已刷新。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
      setAnalyzeStatus(`分析失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (status === "loading" && !snapshot) {
    return <PageLoadingState title="持仓详情加载中" description="正在读取股票详情和技术指标。" />;
  }

  if (status === "error" && !snapshot) {
    return <PageErrorState title="持仓详情加载失败" description={error ?? "无法加载持仓详情。"} actionLabel="重试" onAction={() => void load()} />;
  }

  if (!snapshot?.detail) {
    return <PageEmptyState title="持仓详情为空" description="当前股票没有可展示内容。" actionLabel="返回列表" onAction={() => navigate("/portfolio")} />;
  }

  const detail = snapshot.detail;
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
        title={`${detail.stockName || detail.symbol}`}
        description="查看单只持仓股票的技术指标、K线与待执行信号。"
      />
      <div className="toolbar toolbar--compact" style={{ marginBottom: 12 }}>
        <button className="button button--secondary" type="button" onClick={() => navigate("/portfolio")}>
          返回持仓列表
        </button>
        <button className="button button--secondary" type="button" onClick={() => void refreshIndicators()}>
          刷新技术指标
        </button>
        <button className="button button--secondary" type="button" onClick={() => void runAnalyze()} disabled={isAnalyzing}>
          {isAnalyzing ? "分析中..." : "实时分析"}
        </button>
        <button className="button button--secondary" type="button" onClick={() => void savePosition()}>
          保存持仓信息
        </button>
      </div>
      <div className="stack">
        <WorkbenchCard>
          <div className="summary-item summary-item--accent" style={{ marginBottom: 12 }}>
            <div className="summary-item__title">决策概览</div>
            <div className="summary-item__body">
              决策：{detail.decision.rating ?? "--"} · 更新时间：{detail.decision.updatedAt ?? "--"}
            </div>
            {analyzeStatus ? <div className="summary-item__body" style={{ marginTop: 6 }}>{analyzeStatus}</div> : null}
          </div>

          <h2 className="section-card__title" style={{ fontSize: "1.2rem" }}>
            持仓信息维护
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

          <div className="card-divider" />
          <h2 className="section-card__title" style={{ fontSize: "1.2rem" }}>
            技术指标
          </h2>
          <div className="summary-item portfolio-indicator-panel">
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
          </div>

          <div className="card-divider" />
          <h2 className="section-card__title" style={{ fontSize: "1.2rem" }}>
            K线走势
          </h2>
          <div className="summary-item portfolio-kline-panel">
            <Sparkline points={detail.kline ?? []} height={340} />
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
