import { fireEvent, render, screen } from "@testing-library/react";
import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../lib/api-client";
import { mockPageSnapshot, mockRunPageAction } from "./mock-backend";
import type { PageKey, PageSnapshotMap } from "../lib/page-models";
import { APP_ROUTE_ITEMS } from "../routes/manifest";
import { RoutePlaceholderPage } from "../components/ui/route-placeholder";
import { PortfolioPage } from "../features/portfolio/portfolio-page";
import { AiMonitorPage } from "../features/monitor/ai-monitor-page";
import { RealMonitorPage } from "../features/monitor/real-monitor-page";
import { HistoryPage } from "../features/history/history-page";
import { SettingsPage } from "../features/settings/settings-page";

const client = {
  baseUrl: "/api",
  mode: "mock",
  getPageSnapshot: (async (page: PageKey) => {
    return mockPageSnapshot(page as PageKey);
  }) as unknown as ApiClient["getPageSnapshot"],
  runPageAction: (async (page: PageKey, action: string, payload?: unknown) => {
    return mockRunPageAction(page as PageKey, action, payload);
  }) as unknown as ApiClient["runPageAction"],
  getTaskStatus: (async () => null) as unknown as ApiClient["getTaskStatus"],
} as unknown as ApiClient;

const makeErrorClient = (message: string): ApiClient =>
  ({
    baseUrl: "/api",
    mode: "mock",
    getPageSnapshot: async () => {
      throw new Error(message);
    },
    runPageAction: async () => {
      throw new Error(message);
    },
    getTaskStatus: async () => {
      throw new Error(message);
    },
  }) as unknown as ApiClient;

const makeEmptyClient = (): ApiClient =>
  ({
    baseUrl: "/api",
    mode: "mock",
    getPageSnapshot: async () => null,
    runPageAction: async () => null,
    getTaskStatus: async () => null,
  }) as unknown as ApiClient;

const makeSnapshotClient = <K extends PageKey>(page: K, snapshot: PageSnapshotMap[K]): ApiClient =>
  ({
    baseUrl: "/api",
    mode: "mock",
    getPageSnapshot: async () => snapshot,
    runPageAction: async () => snapshot,
    getTaskStatus: async () => null,
  }) as unknown as ApiClient;

const makePageClient = <K extends PageKey>(page: K) => {
  let snapshot = mockPageSnapshot(page);
  const getPageSnapshot = vi.fn(async () => snapshot);
  const runPageAction = vi.fn(async (_page: PageKey, action: string, payload?: unknown) => {
    snapshot = mockRunPageAction(page, action, payload) as PageSnapshotMap[K];
    return snapshot;
  });

  return {
    client: {
      baseUrl: "/api",
      mode: "mock",
      getPageSnapshot,
      runPageAction,
      getTaskStatus: vi.fn(async () => null) as unknown as ApiClient["getTaskStatus"],
    } as unknown as ApiClient,
    getPageSnapshot,
    runPageAction,
  };
};

describe("ui page coverage", () => {
  it("maps the remaining routes to their pages", () => {
    const portfolioRoute = APP_ROUTE_ITEMS.find((item) => item.path === "/portfolio");
    const aiMonitorRoute = APP_ROUTE_ITEMS.find((item) => item.path === "/ai-monitor");
    const realMonitorRoute = APP_ROUTE_ITEMS.find((item) => item.path === "/real-monitor");
    const historyRoute = APP_ROUTE_ITEMS.find((item) => item.path === "/history");
    const settingsRoute = APP_ROUTE_ITEMS.find((item) => item.path === "/settings");
    const portfolioElement = portfolioRoute?.element;
    const aiMonitorElement = aiMonitorRoute?.element;
    const realMonitorElement = realMonitorRoute?.element;
    const historyElement = historyRoute?.element;
    const settingsElement = settingsRoute?.element;

    expect(isValidElement(portfolioElement) ? portfolioElement.type : undefined).toBe(PortfolioPage);
    expect(isValidElement(aiMonitorElement) ? aiMonitorElement.type : undefined).toBe(AiMonitorPage);
    expect(isValidElement(realMonitorElement) ? realMonitorElement.type : undefined).toBe(RealMonitorPage);
    expect(isValidElement(historyElement) ? historyElement.type : undefined).toBe(HistoryPage);
    expect(isValidElement(settingsElement) ? settingsElement.type : undefined).toBe(SettingsPage);
  });

  it("does not route any page through the placeholder shell", () => {
    const placeholderRoutes = APP_ROUTE_ITEMS.filter(
      (item) => isValidElement(item.element) && item.element.type === RoutePlaceholderPage,
    );

    expect(placeholderRoutes).toHaveLength(0);
  });

  it("renders the portfolio page with holdings, attribution, curve and actions", async () => {
    render(<PortfolioPage client={client} />);

    expect(await screen.findByRole("heading", { name: "持仓分析" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "快照概览" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "当前持仓" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "收益归因" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "组合曲线" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "组合动作" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /分析/ }).length).toBeGreaterThan(0);
  });

  it("shows empty states for portfolio sections when the snapshot is sparse", async () => {
    const snapshot = mockPageSnapshot("portfolio");
    render(
      <PortfolioPage
        client={makeSnapshotClient("portfolio", {
          ...snapshot,
          holdings: { ...snapshot.holdings, rows: [] },
          attribution: [],
          actions: [],
        })}
      />,
    );

    expect(await screen.findByRole("heading", { name: "持仓分析" })).toBeInTheDocument();
    expect(screen.getByText("当前没有持仓明细")).toBeInTheDocument();
    expect(screen.getByText("收益归因暂无数据")).toBeInTheDocument();
    expect(screen.getByText("组合动作暂无数据")).toBeInTheDocument();
  });

  it("renders the ai monitor page with action buttons and queue row actions", async () => {
    const { client: aiClient, runPageAction } = makePageClient("ai-monitor");
    render(<AiMonitorPage client={aiClient} />);

    expect(await screen.findByRole("heading", { name: "AI盯盘" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "快照概览" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "盯盘队列" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "策略信号" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "事件时间线" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "启动盯盘" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "停止盯盘" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "立即分析" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "清空队列" })).toBeInTheDocument();
    expect(screen.getByText("可用动作")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "分析" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "删除" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "立即分析" }));
    expect(runPageAction).toHaveBeenCalledWith("ai-monitor", "analyze", undefined);
    fireEvent.click(screen.getAllByRole("button", { name: "分析" })[0]);
    expect(runPageAction).toHaveBeenCalledWith("ai-monitor", "analyze", { id: "301291" });
  });

  it("shows empty states for ai monitor sections when queue, signals and timeline are empty", async () => {
    const snapshot = mockPageSnapshot("ai-monitor");
    render(
      <AiMonitorPage
        client={makeSnapshotClient("ai-monitor", {
          ...snapshot,
          queue: { ...snapshot.queue, rows: [] },
          signals: [],
          timeline: [],
        })}
      />,
    );

    expect(await screen.findByRole("heading", { name: "AI盯盘" })).toBeInTheDocument();
    expect(screen.getByText("盯盘队列暂无数据")).toBeInTheDocument();
    expect(screen.getByText("策略信号暂无数据")).toBeInTheDocument();
    expect(screen.getByText("事件时间线暂无数据")).toBeInTheDocument();
  });

  it("renders the real monitor page with an editable rule form and payload actions", async () => {
    const { client: realClient, runPageAction } = makePageClient("real-monitor");
    render(<RealMonitorPage client={realClient} />);

    expect(await screen.findByRole("heading", { name: "实时监控" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "快照概览" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "规则编辑器" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "监控规则" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "触发记录" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "通知状态" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "实时操作" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "启动" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "停止" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "连接" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "刷新状态" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "价格突破提醒" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "量价异动提醒" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "持仓风险提醒" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("规则名称"), { target: { value: "价格破位提醒（更新版）" } });
    fireEvent.change(screen.getByLabelText("规则说明"), { target: { value: "当价格跌破 MA20 且量能放大时触发提醒。" } });
    fireEvent.change(screen.getByLabelText("提醒级别"), { target: { value: "warning" } });
    fireEvent.click(screen.getByRole("button", { name: "保存规则" }));

    expect(runPageAction).toHaveBeenCalledWith(
      "real-monitor",
      "update-rule",
      expect.objectContaining({
        index: 0,
        title: "价格破位提醒（更新版）",
        body: "当价格跌破 MA20 且量能放大时触发提醒。",
        tone: "warning",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "删除规则" }));
    expect(runPageAction).toHaveBeenCalledWith("real-monitor", "delete-rule", expect.objectContaining({ index: 0 }));
  });

  it("renders the history page with the snapshot curve labels", async () => {
    render(<HistoryPage client={client} />);

    expect(await screen.findByRole("heading", { name: "历史记录" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "快照概览" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "分析记录" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "最近回放" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "时间曲线" })).toBeInTheDocument();
    expect(screen.getByText("T-2")).toBeInTheDocument();
    expect(screen.getByText("T-1")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "工作流轨迹" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新整理" })).toBeInTheDocument();
  });

  it("shows empty states for history sections when records and timeline are absent", async () => {
    const snapshot = mockPageSnapshot("history");
    render(
      <HistoryPage
        client={makeSnapshotClient("history", {
          ...snapshot,
          records: { ...snapshot.records, rows: [] },
          timeline: [],
          curve: [],
        })}
      />,
    );

    expect(await screen.findByRole("heading", { name: "历史记录" })).toBeInTheDocument();
    expect(screen.getByText("分析记录暂无数据")).toBeInTheDocument();
    expect(screen.getByText("工作流轨迹暂无数据")).toBeInTheDocument();
    expect(screen.getByText("暂无曲线数据")).toBeInTheDocument();
  });

  it("shows an empty state for history records when no rows exist", async () => {
    const snapshot = mockPageSnapshot("history");
    render(
      <HistoryPage
        client={makeSnapshotClient("history", {
          ...snapshot,
          records: { ...snapshot.records, rows: [] },
        })}
      />,
    );

    expect(await screen.findByRole("heading", { name: "历史记录" })).toBeInTheDocument();
    expect(screen.getByText("分析记录暂无数据")).toBeInTheDocument();
    expect(screen.getByText("当前没有可展示的分析记录，稍后可点击重新整理或等待新的结果写入。")).toBeInTheDocument();
  });

  it("renders the settings page with snapshot metadata and core sections", async () => {
    render(<SettingsPage client={client} />);

    expect(await screen.findByRole("heading", { name: "环境配置" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "数据源" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "运行参数" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "刷新配置" })).toBeInTheDocument();
  });

  it("shows empty states for settings sections when values are missing", async () => {
    const snapshot = mockPageSnapshot("settings");
    render(
      <SettingsPage
        client={makeSnapshotClient("settings", {
          ...snapshot,
          dataSources: [],
          runtimeParams: [],
        })}
      />,
    );

    expect(await screen.findByRole("heading", { name: "环境配置" })).toBeInTheDocument();
    expect(screen.getByText("数据源暂无数据")).toBeInTheDocument();
    expect(screen.getByText("运行参数暂无数据")).toBeInTheDocument();
  });

  it("shows the portfolio empty state", async () => {
    render(<PortfolioPage client={makeEmptyClient()} />);
    expect(await screen.findByRole("heading", { name: "持仓分析暂无数据" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "刷新" })).toBeInTheDocument();
  });

  it("shows the settings error state", async () => {
    render(<SettingsPage client={makeErrorClient("settings offline")} />);
    expect(await screen.findByRole("heading", { name: "环境配置加载失败" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
  });

  it("renders a safe empty real monitor editor when no rules exist", async () => {
    const snapshot = mockPageSnapshot("real-monitor");
    render(
      <RealMonitorPage
        client={makeSnapshotClient("real-monitor", {
          ...snapshot,
          rules: [],
        })}
      />,
    );

    expect(await screen.findByRole("heading", { name: "实时监控" })).toBeInTheDocument();
    expect(screen.getByText("当前没有可编辑的监控规则")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存规则" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "删除规则" })).toBeDisabled();
    expect(screen.getByRole("heading", { level: 2, name: "监控规则" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "触发记录" })).toBeInTheDocument();
  });
});
