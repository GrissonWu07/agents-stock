import { useEffect, useState } from "react";
import type { ApiClient } from "../../lib/api-client";
import { PageHeader } from "../../components/ui/page-header";
import { WorkbenchCard } from "../../components/ui/workbench-card";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../../components/ui/page-state";
import { usePageData } from "../../lib/use-page-data";
import { NextStepsPanel } from "./next-steps-panel";
import { StockAnalysisPanel } from "./stock-analysis-panel";
import { WatchlistPanel } from "./watchlist-panel";

type WorkbenchPageProps = {
  client?: ApiClient;
};

const DEFAULT_ANALYSTS = ["technical", "fundamental", "fund_flow", "risk"];

export function WorkbenchPage({ client }: WorkbenchPageProps) {
  const resource = usePageData("workbench", client);
  const snapshot = resource.data;
  const analysisJob = snapshot?.analysisJob ?? null;
  const [localAnalysisPending, setLocalAnalysisPending] = useState(false);
  const [analysisInputSeed, setAnalysisInputSeed] = useState("");
  const analysisBusy = Boolean(analysisJob && ["queued", "running"].includes(analysisJob.status));
  const analysisSummary = snapshot?.analysis?.summaryBody?.trim() ?? "";
  const analysisDecision = (snapshot?.analysis?.finalDecisionText ?? snapshot?.analysis?.decision ?? "").trim();
  const placeholderTexts = new Set([
    "",
    "先从我的关注里添加股票，再开始分析。",
    "请输入股票代码后，系统会生成完整的分析结果。",
    "请输入股票代码后再查看分析结果。",
    "分析完成。",
  ]);
  const hasUsableAnalysis = Boolean(
    snapshot?.analysis?.generatedAt ||
      (analysisSummary && !placeholderTexts.has(analysisSummary)) ||
      (analysisDecision && !placeholderTexts.has(analysisDecision)) ||
      snapshot?.analysis?.analystViews?.length,
  );
  const showAnalysisBusy = localAnalysisPending || analysisBusy;
  const analysisBusyMessage = analysisJob?.message ?? "正在分析中...";
  const analysisRefreshFailure =
    analysisJob?.status === "failed" && hasUsableAnalysis
      ? {
          title: "最近一次刷新失败",
          body: analysisJob.message ?? "当前显示的是最近一次成功分析。",
          generatedAt: snapshot?.analysis?.generatedAt ?? "",
        }
      : null;

  useEffect(() => {
    // 仅在后端显式提供异步任务状态时轮询，避免同步分析结果被默认快照覆盖。
    if (!analysisBusy) return undefined;
    const timer = window.setInterval(() => {
      void resource.refresh();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [analysisBusy, resource.refresh]);

  useEffect(() => {
    if (analysisBusy) return;
    setLocalAnalysisPending(false);
  }, [analysisBusy]);

  if (resource.status === "loading" && !resource.data) {
    return <PageLoadingState title="工作台加载中" description="正在拉取我的关注、股票分析和下一步入口。" />;
  }

  if (resource.status === "error" && !resource.data) {
    return (
      <PageErrorState
        title="工作台加载失败"
        description={resource.error ?? "无法加载工作台数据，请稍后重试。"}
        actionLabel="重新加载"
        onAction={resource.refresh}
      />
    );
  }

  if (!snapshot) {
    return <PageEmptyState title="工作台暂无数据" description="后台尚未返回工作台快照。" actionLabel="刷新" onAction={resource.refresh} />;
  }

  const handleAnalyze = async (payload: { symbol: string; analysts: string[]; mode: string; cycle: string }) => {
    if (showAnalysisBusy) return;
    setLocalAnalysisPending(true);
    try {
      await resource.runAction("analysis", {
        stockCode: payload.symbol,
        analysts: payload.analysts,
        mode: payload.mode,
        cycle: payload.cycle,
      });
    } finally {
      setLocalAnalysisPending(false);
    }
  };

  const handleBatchAnalyze = async (payload: { stockCodes: string[]; analysts: string[]; mode: string; cycle: string }) => {
    if (showAnalysisBusy) return;
    setLocalAnalysisPending(true);
    try {
      await resource.runAction("analysis-batch", {
        stockCodes: payload.stockCodes,
        analysts: payload.analysts,
        mode: payload.mode,
        cycle: payload.cycle,
      });
    } finally {
      setLocalAnalysisPending(false);
    }
  };

  const handleBatchFillAnalysisInput = (codes: string[]) => {
    const normalized = Array.from(new Set(codes.map((item) => item.trim()).filter(Boolean)));
    if (normalized.length === 0) return;
    setAnalysisInputSeed(normalized.join(","));
  };

  const defaultAnalysts = (() => {
    const selected = snapshot.analysis.analysts.filter((item) => item.selected).map((item) => item.value);
    return selected.length > 0 ? selected : DEFAULT_ANALYSTS;
  })();

  return (
    <div>
      <PageHeader
        eyebrow="玄武AI智能体股票团队分析系统"
        title="工作台"
        description="先看我的关注 -> 将股票加入我的关注，再继续做股票分析、发现股票、研究情报和量化验证。所有核心操作都围绕当前工作台页面展开。"
      />
      <div className="metric-grid">
        {snapshot.metrics.map((item) => (
          <WorkbenchCard className="metric-card" key={item.label}>
            <div className="metric-card__label">{item.label}</div>
            <div className="metric-card__value">{item.value}</div>
          </WorkbenchCard>
        ))}
      </div>
      <div className="workbench-layout">
        <div className="stack">
          <WatchlistPanel
            watchlist={snapshot.watchlist}
            quantCount={snapshot.watchlistMeta.quantCount}
            refreshHint={snapshot.watchlistMeta.refreshHint}
            onAddWatchlist={(code) => resource.runAction("add-watchlist", { code })}
            onRefresh={() => resource.runAction("refresh-watchlist")}
            onBatchQuant={(codes) => resource.runAction("batch-quant", { codes })}
            onBatchAnalyzeInput={handleBatchFillAnalysisInput}
            onClearSelection={() => resource.runAction("clear-selection")}
            onRemoveWatchlist={(code) => resource.runAction("delete-watchlist", { code })}
            onAnalyzeWatchlist={(code) =>
              handleAnalyze({
                symbol: code,
                analysts: defaultAnalysts,
                mode: snapshot.analysis.mode,
                cycle: snapshot.analysis.cycle,
              })
            }
          />
          <StockAnalysisPanel
            analysis={snapshot.analysis}
            analysisJob={analysisJob}
            busy={showAnalysisBusy}
            busyMessage={analysisBusyMessage}
            refreshFailure={analysisRefreshFailure}
            inputSeed={analysisInputSeed}
            onAnalyze={handleAnalyze}
            onBatchAnalyze={handleBatchAnalyze}
            onClearInput={() => undefined}
          />
        </div>
        <NextStepsPanel steps={snapshot.nextSteps} />
      </div>
    </div>
  );
}
