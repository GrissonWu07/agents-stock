import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../lib/api-client";
import type { PortfolioSnapshot } from "../lib/page-models";
import { PortfolioPositionPage } from "../features/portfolio/portfolio-position-page";

const stockAnalysisSnapshot = (summaryBody: string): PortfolioSnapshot => ({
  updatedAt: "2026-04-25 10:00:00",
  metrics: [],
  holdings: { columns: [], rows: [], emptyLabel: "暂无持仓" },
  attribution: [],
  curve: [],
  actions: [],
  selectedSymbol: "600519",
  detail: {
    symbol: "600519",
    stockName: "贵州茅台",
    sector: "白酒",
    kline: [],
    indicators: [],
    pendingSignals: { columns: [], rows: [], emptyLabel: "暂无待执行信号" },
    decision: {
      rating: "持有",
      summary: "持仓分析结论",
      updatedAt: "2026-04-25 09:50:00",
    },
    marketSnapshot: {
      code: "600519",
      name: "贵州茅台",
      sector: "白酒",
      latestPrice: "1453.96",
      latestSignal: "HOLD",
      source: "关注池",
      updatedAt: "2026-04-25 09:56:00",
      inQuantPool: true,
    },
    positionForm: {
      quantity: "0",
      costPrice: "--",
      takeProfit: "--",
      stopLoss: "--",
      note: "",
    },
    stockAnalysis: {
      symbol: "600519",
      stockName: "贵州茅台",
      analysts: [],
      mode: "单个分析",
      cycle: "1y",
      inputHint: "600519",
      summaryTitle: "贵州茅台 分析摘要",
      summaryBody,
      generatedAt: "2026-04-25 09:55:00",
      indicators: [
        { label: "RSI", value: "53.79", hint: "相对强弱" },
        { label: "MACD", value: "6.27", hint: "动量" },
      ],
      decision: "建议继续跟踪",
      finalDecisionText: "建议继续跟踪，等待更舒适的参与位置。",
      insights: [{ title: "操作建议", body: "等待回踩确认。", tone: "accent" }],
      analystViews: [
        { title: "技术分析师", body: "趋势稳健，等待回踩更合适。\n\n- 均线结构改善\n- 量能需要确认" },
        { title: "风险管理师", body: "波动抬升，控制仓位。\n\n**风险点**：追高回撤。" },
      ],
      curve: [],
    },
  },
});

const withRealtimeData = (snapshot: PortfolioSnapshot, summaryBody = snapshot.detail?.stockAnalysis?.summaryBody ?? ""): PortfolioSnapshot => ({
  ...snapshot,
  detail: snapshot.detail
    ? {
        ...snapshot.detail,
        kline: [
          { label: "2026-04-24", value: 1450, open: 1440, high: 1460, low: 1430, close: 1450, volume: 120000 },
          { label: "2026-04-25", value: 1453.96, open: 1450, high: 1468, low: 1448, close: 1453.96, volume: 130000 },
        ],
        indicators: [
          { label: "5日均量", value: "47265.40", hint: "5-period average volume." },
          { label: "MA5", value: "1450.10", hint: "5-day moving average." },
          { label: "MA10", value: "1448.20", hint: "10-day moving average." },
          { label: "MA20", value: "1441.86", hint: "20日均线" },
          { label: "MA60", value: "1430.66", hint: "60-day moving average." },
          { label: "RSI", value: "53.79", hint: "RSI 位于 30-70 之间。" },
          { label: "MACD", value: "6.27", hint: "MACD 大于 0。" },
          { label: "信号线", value: "5.12", hint: "MACD signal line." },
          { label: "布林上轨", value: "1472.20", hint: "Upper volatility band." },
          { label: "K值", value: "64.30", hint: "KDJ fast line." },
          { label: "D值", value: "58.10", hint: "KDJ slow line." },
          { label: "量比", value: "1.18", hint: "Relative activity vs average volume." },
        ],
        stockAnalysis: snapshot.detail.stockAnalysis
          ? {
              ...snapshot.detail.stockAnalysis,
              summaryBody,
            }
          : null,
      }
    : snapshot.detail,
});

function renderPortfolioPositionPage(client: ApiClient, initialEntries = ["/portfolio/position/600519"]) {
  const router = createMemoryRouter(
    [
      { path: "/workbench", element: <div data-testid="workbench-page">工作台列表</div> },
      { path: "/portfolio/position/:symbol", element: <PortfolioPositionPage client={client} /> },
    ],
    { initialEntries },
  );
  render(<RouterProvider router={router} />);
}

function renderPortfolioPositionPageStrict(client: ApiClient, initialEntries = ["/portfolio/position/600519"]) {
  const router = createMemoryRouter(
    [
      { path: "/workbench", element: <div data-testid="workbench-page">工作台列表</div> },
      { path: "/portfolio/position/:symbol", element: <PortfolioPositionPage client={client} /> },
    ],
    { initialEntries },
  );
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe("PortfolioPositionPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("renders the last cached detail snapshot before the detail request returns", async () => {
    const cachedSnapshot = withRealtimeData(stockAnalysisSnapshot("本地上一版分析结论"));
    window.localStorage.setItem("portfolio-position-snapshot:600519", JSON.stringify(cachedSnapshot));
    const latestRequest = deferred<PortfolioSnapshot>();
    const getPortfolioPosition = vi.fn().mockReturnValue(latestRequest.promise);
    const runPageAction = vi.fn().mockResolvedValue(cachedSnapshot);
    const client = {
      getPortfolioPosition,
      patchPortfolioPosition: vi.fn(),
      runPageAction,
      getTaskStatus: vi.fn(),
    } as unknown as ApiClient;

    window.localStorage.setItem("portfolio-position-snapshot:600519", JSON.stringify(cachedSnapshot));
    renderPortfolioPositionPage(client);

    expect(screen.queryByText("持仓详情加载中")).toBeNull();
    expect(screen.getByText("本地上一版分析结论")).toBeInTheDocument();
    expect((screen.getAllByText("MA20")).length).toBeGreaterThan(0);
    expect(screen.getByText(/开 1450\.0/)).toBeInTheDocument();
    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith("portfolio", "refresh-indicators", {
        symbols: ["600519"],
        selectedSymbol: "600519",
        scope: "indicators_only",
      });
    });

    latestRequest.resolve(stockAnalysisSnapshot("接口返回后的完整分析结论内容"));

    await waitFor(() => {
      expect(getPortfolioPosition).toHaveBeenCalledWith("600519");
    });
    expect(await screen.findByText("接口返回后的完整分析结论内容")).toBeInTheDocument();
  });

  it("auto-refreshes realtime data and updates stock analysis through one button", async () => {
    const cachedSnapshot = stockAnalysisSnapshot("旧的股票分析结论");
    const realtimeSnapshot = withRealtimeData(cachedSnapshot);
    const updatedSnapshot = withRealtimeData(cachedSnapshot, "更新后的股票分析结论");
    let analysisSubmitted = false;
    const getPortfolioPosition = vi.fn().mockResolvedValue(cachedSnapshot);
    const runPageAction = vi.fn().mockImplementation((page: string, action: string) => {
      if (page === "portfolio" && action === "refresh-indicators") {
        return Promise.resolve(analysisSubmitted ? updatedSnapshot : realtimeSnapshot);
      }
      if (page === "workbench" && action === "analysis") {
        analysisSubmitted = true;
        return Promise.resolve({
          taskId: "analysis-600519",
          analysisJob: {
            id: "analysis-600519",
            status: "completed",
            title: "分析已完成",
            message: "600519 分析完成",
          },
        });
      }
      return Promise.reject(new Error(`unexpected action ${page}.${action}`));
    });
    const client = {
      getPortfolioPosition,
      patchPortfolioPosition: vi.fn(),
      runPageAction,
      getTaskStatus: vi.fn(),
    } as unknown as ApiClient;

    window.localStorage.setItem("portfolio-position-snapshot:600519", JSON.stringify(cachedSnapshot));
    renderPortfolioPositionPage(client);

    expect(await screen.findByRole("heading", { name: "当前股票分析" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "实时分析" })).toBeNull();
    expect(screen.queryByRole("button", { name: "更新股票分析" })).toBeNull();
    expect(screen.getByRole("heading", { name: "600519 贵州茅台" })).toBeInTheDocument();
    expect(screen.getByText("板块：白酒 · 现价：1453.96 · 更新时间：2026-04-25 09:56:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新分析" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新详情" })).toBeInTheDocument();
    expect(screen.queryByText("基础信息")).toBeNull();
    expect(screen.getByRole("heading", { name: "决策计划" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "决策概览" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "交易计划" })).toBeNull();
    expect(screen.getByRole("heading", { name: "关键技术指标" })).toBeInTheDocument();
    expect(screen.getByText("更多指标明细")).toBeInTheDocument();
    expect(screen.getByText("完整分析原文")).toBeInTheDocument();
    expect(document.querySelector(".portfolio-kline-card--full")).not.toBeNull();
    expect(screen.queryByText("持仓分析结论")).toBeNull();
    expect(screen.queryByText("当前未登记持仓，先以观察和建仓条件确认作为主线。")).toBeNull();
    expect(screen.getByText("分析日期：2026-04-25 09:55:00")).toBeInTheDocument();

    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith("portfolio", "refresh-indicators", {
        symbols: ["600519"],
        selectedSymbol: "600519",
        scope: "indicators_only",
      });
    });
    expect((await screen.findAllByText("MA20")).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(document.querySelectorAll(".portfolio-indicator-chip-grid--summary .portfolio-indicator-chip")).toHaveLength(8);
    });
    expect(screen.getAllByText("MA5")).toHaveLength(1);
    expect(screen.getAllByText("K值")).toHaveLength(1);
    expect(await screen.findByText(/开 1450\.0/)).toBeInTheDocument();
    expect(document.querySelector(".analyst-layout")).not.toBeNull();
    expect(document.querySelectorAll(".analyst-tab")).toHaveLength(2);
    expect(document.querySelector(".analyst-tab--active")).toHaveTextContent("技术分析师");
    expect(screen.getByText("均线结构改善")).toBeInTheDocument();
    expect(screen.queryByText(/追高回撤/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "风险管理师" }));
    expect(screen.getByRole("button", { name: "风险管理师" })).toHaveClass("analyst-tab--active");
    expect(screen.getByText(/追高回撤/)).toBeInTheDocument();
    const pageText = document.body.textContent ?? "";
    expect(pageText.indexOf("决策计划")).toBeGreaterThan(-1);
    expect(pageText.indexOf("K线走势")).toBeGreaterThan(-1);
    expect(pageText.indexOf("关键技术指标")).toBeGreaterThan(-1);
    expect(pageText.indexOf("当前股票分析")).toBeGreaterThan(-1);
    expect(pageText.indexOf("决策计划")).toBeLessThan(pageText.indexOf("关键技术指标"));
    expect(pageText.indexOf("关键技术指标")).toBeLessThan(pageText.indexOf("K线走势"));
    expect(pageText.indexOf("K线走势")).toBeLessThan(pageText.indexOf("当前股票分析"));

    fireEvent.click(screen.getByRole("button", { name: "更新详情" }));
    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "更新分析" }));

    await waitFor(() => {
      expect(screen.getByText("更新后的股票分析结论")).toBeInTheDocument();
    });
    expect(runPageAction).toHaveBeenCalledWith("workbench", "analysis", {
      stockCode: "600519",
      analysts: ["technical", "fundamental", "fund_flow", "risk"],
      cycle: "1y",
      mode: "单个分析",
    });
  });

  it("does not let a late cache-only detail response erase refreshed indicators", async () => {
    const cachedSnapshot = stockAnalysisSnapshot("缓存股票分析结论");
    const realtimeSnapshot = withRealtimeData(cachedSnapshot);
    const lateCachedSnapshot = {
      ...cachedSnapshot,
      updatedAt: "2026-04-25 10:01:00",
    };
    const lateGet = deferred<PortfolioSnapshot>();
    const getPortfolioPosition = vi.fn().mockResolvedValueOnce(cachedSnapshot).mockReturnValueOnce(lateGet.promise);
    const runPageAction = vi.fn().mockResolvedValue(realtimeSnapshot);
    const client = {
      getPortfolioPosition,
      patchPortfolioPosition: vi.fn(),
      runPageAction,
      getTaskStatus: vi.fn(),
    } as unknown as ApiClient;

    renderPortfolioPositionPageStrict(client);

    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith("portfolio", "refresh-indicators", {
        symbols: ["600519"],
        selectedSymbol: "600519",
        scope: "indicators_only",
      });
    });
    expect((await screen.findAllByText("MA20")).length).toBeGreaterThan(0);

    lateGet.resolve(lateCachedSnapshot);

    await waitFor(() => {
      expect(getPortfolioPosition).toHaveBeenCalledTimes(2);
    });
    expect(screen.getAllByText("MA20").length).toBeGreaterThan(0);
    expect(screen.queryByText("暂无K线数据，点击“更新详情”拉取最新行情、K线和技术指标。")).toBeNull();
  });

  it("renders stock analysis text in scrollable markdown blocks without plain text truncation", async () => {
    const snapshot = stockAnalysisSnapshot("完整摘要第一行\n\n- 摘要要点二");
    const client = {
      getPortfolioPosition: vi.fn().mockResolvedValue(snapshot),
      patchPortfolioPosition: vi.fn(),
      runPageAction: vi.fn().mockResolvedValue(withRealtimeData(snapshot)),
      getTaskStatus: vi.fn(),
    } as unknown as ApiClient;

    renderPortfolioPositionPage(client);

    await waitFor(() => {
      expect(screen.getByText("完整摘要第一行").closest(".markdown-body.content-scroll")).not.toBeNull();
      expect(screen.getByText("建议继续跟踪，等待更舒适的参与位置。").closest(".markdown-body.content-scroll")).not.toBeNull();
      expect(screen.getByText("等待回踩确认。").closest(".markdown-body.content-scroll")).not.toBeNull();
    });
  });

  it("uses completed analysis task results immediately without requiring a page refresh", async () => {
    const cachedSnapshot = stockAnalysisSnapshot("旧的股票分析结论");
    const staleRealtimeSnapshot = withRealtimeData(cachedSnapshot, "旧的股票分析结论");
    const completedAnalysis = stockAnalysisSnapshot("任务完成后的完整分析结果").detail?.stockAnalysis;
    const getPortfolioPosition = vi.fn().mockResolvedValue(cachedSnapshot);
    const runPageAction = vi.fn().mockImplementation((page: string, action: string) => {
      if (page === "workbench" && action === "analysis") {
        return Promise.resolve({
          taskId: "analysis-600519",
          analysisJob: {
            id: "analysis-600519",
            status: "queued",
            title: "分析已提交",
            message: "600519 分析排队中",
            progress: 0,
          },
        });
      }
      if (page === "portfolio" && action === "refresh-indicators") {
        return Promise.resolve(staleRealtimeSnapshot);
      }
      return Promise.reject(new Error(`unexpected action ${page}.${action}`));
    });
    const getTaskStatus = vi.fn().mockResolvedValue({
      id: "analysis-600519",
      status: "completed",
      title: "分析已完成",
      message: "600519 分析完成",
      progress: 100,
      results: [completedAnalysis],
    });
    const client = {
      getPortfolioPosition,
      patchPortfolioPosition: vi.fn(),
      runPageAction,
      getTaskStatus,
    } as unknown as ApiClient;

    renderPortfolioPositionPage(client);

    await screen.findByText("旧的股票分析结论");
    fireEvent.click(screen.getByRole("button", { name: "更新分析" }));

    expect(await screen.findByText("任务完成后的完整分析结果")).toBeInTheDocument();
    expect(screen.queryByText("旧的股票分析结论")).toBeNull();
  });

  it("lets stock detail choose analysis team and cycle before updating analysis", async () => {
    const snapshot = stockAnalysisSnapshot("股票分析结论");
    const getPortfolioPosition = vi.fn().mockResolvedValue(snapshot);
    const runPageAction = vi.fn().mockImplementation((page: string, action: string) => {
      if (page === "workbench" && action === "analysis") {
        return Promise.resolve({
          taskId: "analysis-600519",
          analysisJob: {
            id: "analysis-600519",
            status: "completed",
            title: "分析已完成",
            message: "600519 分析完成",
          },
          analysis: snapshot.detail?.stockAnalysis,
        });
      }
      if (page === "portfolio" && action === "refresh-indicators") {
        return Promise.resolve(withRealtimeData(snapshot));
      }
      return Promise.reject(new Error(`unexpected action ${page}.${action}`));
    });
    const client = {
      getPortfolioPosition,
      patchPortfolioPosition: vi.fn(),
      runPageAction,
      getTaskStatus: vi.fn(),
    } as unknown as ApiClient;

    renderPortfolioPositionPage(client);

    await screen.findByText("股票分析结论");
    const riskControl = screen.getByRole("button", { name: "分析设置：风险分析师" });
    fireEvent.click(riskControl);
    await waitFor(() => {
      expect(riskControl).not.toHaveClass("chip--active");
    });
    fireEvent.change(screen.getByLabelText("分析周期"), { target: { value: "30m" } });
    fireEvent.click(screen.getByRole("button", { name: "更新分析" }));

    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith("workbench", "analysis", {
        stockCode: "600519",
        analysts: ["technical", "fundamental", "fund_flow"],
        cycle: "30m",
        mode: "单个分析",
      });
    });
  });

  it("uses compact holding labels and updates the position from one-line form", async () => {
    const client = {
      getPortfolioPosition: vi.fn().mockResolvedValue(stockAnalysisSnapshot("股票分析结论")),
      patchPortfolioPosition: vi.fn().mockResolvedValue(stockAnalysisSnapshot("股票分析结论")),
      runPageAction: vi.fn().mockResolvedValue(stockAnalysisSnapshot("股票分析结论")),
      getTaskStatus: vi.fn(),
    } as unknown as ApiClient;

    renderPortfolioPositionPage(client);

    await screen.findByText("股票分析结论");
    expect(screen.getByRole("heading", { name: "持仓信息" })).toBeInTheDocument();
    expect(screen.queryByText("持仓信息维护")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "更新持仓" }));

    await waitFor(() => {
      expect(client.patchPortfolioPosition).toHaveBeenCalledWith("600519", {
        quantity: "0",
        costPrice: "--",
        takeProfit: "--",
        stopLoss: "--",
      });
    });
  });

  it("uses browser history for the back action", async () => {
    const client = {
      getPortfolioPosition: vi.fn().mockResolvedValue(stockAnalysisSnapshot("股票分析结论")),
      patchPortfolioPosition: vi.fn(),
      runPageAction: vi.fn(),
      getTaskStatus: vi.fn(),
    } as unknown as ApiClient;

    renderPortfolioPositionPage(client, ["/workbench", "/portfolio/position/600519"]);

    await screen.findByText("股票分析结论");
    fireEvent.click(screen.getByRole("button", { name: "返回上一页" }));

    await waitFor(() => {
      expect(screen.getByTestId("workbench-page")).toBeInTheDocument();
    });
  });
});
