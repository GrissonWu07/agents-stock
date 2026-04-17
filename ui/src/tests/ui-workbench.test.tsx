import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkbenchPage } from "../features/workbench/workbench-page";
import type { ApiClient } from "../lib/api-client";
import { mockPageSnapshot } from "./mock-backend";

const createTaskStatusMock = () => vi.fn(async () => null) as unknown as ApiClient["getTaskStatus"];

const createClient = () => {
  const snapshot = mockPageSnapshot("workbench");
  const runPageAction = vi.fn(async () => snapshot);

  const client: ApiClient = {
    baseUrl: "/api",
    mode: "mock",
    getPageSnapshot: vi.fn(async () => snapshot) as unknown as ApiClient["getPageSnapshot"],
    runPageAction: runPageAction as unknown as ApiClient["runPageAction"],
    getTaskStatus: createTaskStatusMock(),
  };

  return { client, runPageAction };
};

const buildWatchlistRows = (count: number) =>
  Array.from({ length: count }, (_, index) => {
    const code = String(600000 + index);
    return {
      id: code,
      cells: [
        code,
        index === 57 ? "贵州茅台" : `股票${index + 1}`,
        `${100 + index}.00`,
        index % 2 === 0 ? "主力选股" : "研究情报",
        index % 3 === 0 ? "待分析" : "观察中",
        index % 4 === 0 ? "已入量化" : "未加入",
      ],
      actions: [
        { label: "分析", icon: "🔎", tone: "accent" as const },
        { label: "入量化", icon: "🧪", tone: "neutral" as const },
        { label: "删除", icon: "🗑", tone: "danger" as const },
      ],
      code,
      name: index === 57 ? "贵州茅台" : `股票${index + 1}`,
      source: index % 2 === 0 ? "主力选股" : "研究情报",
      latestPrice: `${100 + index}.00`,
    };
  });

describe("workbench page", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a completed analysis workflow without placeholder wording", async () => {
    const { client } = createClient();

    render(
      <MemoryRouter>
        <WorkbenchPage client={client} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "股票分析" })).toBeInTheDocument();
    expect(screen.getByText("1. 分析团队")).toBeInTheDocument();
    expect(screen.getByText("2. 分析配置")).toBeInTheDocument();
    expect(screen.getByText("3. 股票代码")).toBeInTheDocument();
    expect(screen.getByText("4. 分析结果")).toBeInTheDocument();
    expect(screen.getByText("当前分析团队")).toBeInTheDocument();
    expect(screen.getByText("最终决策")).toBeInTheDocument();
    expect(screen.getByText("分析师观点")).toBeInTheDocument();
    expect(screen.getByText("量化证据")).toBeInTheDocument();
    expect(screen.getByText("走势摘要")).toBeInTheDocument();
    expect(screen.queryByText("分析配置与结果")).not.toBeInTheDocument();
    expect(screen.queryByText("输入与状态")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "批量分析" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "清空输入" })).toBeInTheDocument();
    expect(screen.queryByText("第 1 步：选择分析师")).not.toBeInTheDocument();
    expect(screen.queryByText("第 2-4 步：模式、周期、股票与结果")).not.toBeInTheDocument();
  });

  it("dispatches analysis actions with selected analysts and batch codes", async () => {
    const { client, runPageAction } = createClient();

    render(
      <MemoryRouter>
        <WorkbenchPage client={client} />
      </MemoryRouter>,
    );

    const analysisHeading = await screen.findByRole("heading", { name: "股票分析" });
    const analysisCard = analysisHeading.closest("section");
    expect(analysisCard).toBeTruthy();

    const analysisSection = within(analysisCard as HTMLElement);

    fireEvent.click(analysisSection.getByRole("button", { name: "新闻分析师" }));
    fireEvent.change(analysisSection.getByLabelText("股票代码 / 批量代码"), { target: { value: "600519" } });
    fireEvent.click(analysisSection.getByRole("button", { name: "分析" }));

    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith(
        "workbench",
        "analysis",
        expect.objectContaining({
          stockCode: "600519",
          mode: "单个分析",
          cycle: "1y",
        }),
      );
    });

    fireEvent.change(analysisSection.getByLabelText("股票代码 / 批量代码"), { target: { value: "600519, 300390" } });
    fireEvent.click(analysisSection.getByRole("button", { name: "批量分析" }));

    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith(
        "workbench",
        "analysis-batch",
        expect.objectContaining({
          stockCodes: ["600519", "300390"],
          mode: "单个分析",
          cycle: "1y",
        }),
      );
    });
  });

  it("shows inline stage status while the workbench analysis job is running", async () => {
    const snapshot = mockPageSnapshot("workbench");
    snapshot.analysis.summaryBody = "";
    snapshot.analysis.finalDecisionText = "";
    snapshot.analysis.analystViews = [];
    snapshot.analysis.insights = [];
    const queued = structuredClone(snapshot);
    queued.analysisJob = {
      id: "job-1",
      status: "running",
      title: "分析进行中",
      message: "正在获取行情与财务数据",
      stage: "enrich",
      progress: 18,
      symbol: "002463",
    };
    const client: ApiClient = {
      baseUrl: "/api",
      mode: "mock",
      getPageSnapshot: vi.fn(async () => snapshot) as unknown as ApiClient["getPageSnapshot"],
      runPageAction: vi.fn(async (_page, action) => {
        if (action === "analysis") {
          return queued;
        }
        return snapshot;
      }) as unknown as ApiClient["runPageAction"],
      getTaskStatus: createTaskStatusMock(),
    };

    render(
      <MemoryRouter>
        <WorkbenchPage client={client} />
      </MemoryRouter>,
    );

    const analysisHeading = await screen.findByRole("heading", { name: "股票分析" });
    const analysisCard = analysisHeading.closest("section");
    expect(analysisCard).toBeTruthy();
    const analysisSection = within(analysisCard as HTMLElement);

    fireEvent.change(analysisSection.getByLabelText("股票代码 / 批量代码"), { target: { value: "002463" } });
    fireEvent.click(analysisSection.getByRole("button", { name: "分析" }));

    expect(await screen.findByText("本轮分析进度")).toBeInTheDocument();
    expect(screen.getByText("正在获取行情与财务数据")).toBeInTheDocument();
    expect(screen.getAllByText("分析师观点").length).toBeGreaterThan(0);
    expect(screen.getAllByText("团队讨论").length).toBeGreaterThan(0);
    expect(screen.getAllByText("最终决策").length).toBeGreaterThan(0);
    expect(analysisSection.getByRole("button", { name: "分析" })).toBeDisabled();
  });

  it("keeps cached analysis visible while a refresh is in progress", async () => {
    const snapshot = mockPageSnapshot("workbench");
    snapshot.analysis.generatedAt = "2026-04-15T10:41:20.634856";
    const queued = structuredClone(snapshot);
    queued.analysisJob = {
      id: "job-2",
      status: "running",
      title: "分析进行中",
      message: "正在补充财务与资金面数据",
      stage: "enrich",
      progress: 18,
      symbol: "002463",
    };
    const client: ApiClient = {
      baseUrl: "/api",
      mode: "mock",
      getPageSnapshot: vi.fn(async () => snapshot) as unknown as ApiClient["getPageSnapshot"],
      runPageAction: vi.fn(async () => queued) as unknown as ApiClient["runPageAction"],
      getTaskStatus: createTaskStatusMock(),
    };

    render(
      <MemoryRouter>
        <WorkbenchPage client={client} />
      </MemoryRouter>,
    );

    const analysisHeading = await screen.findByRole("heading", { name: "股票分析" });
    const analysisCard = analysisHeading.closest("section");
    expect(analysisCard).toBeTruthy();
    const analysisSection = within(analysisCard as HTMLElement);

    fireEvent.change(analysisSection.getByLabelText("股票代码 / 批量代码"), { target: { value: "002463" } });
    fireEvent.click(analysisSection.getByRole("button", { name: "分析" }));

    expect(await screen.findByText("本轮分析进度")).toBeInTheDocument();
    expect(screen.getByText("正在补充财务与资金面数据")).toBeInTheDocument();
    expect(screen.getByText("生成时间：2026-04-15T10:41:20.634856")).toBeInTheDocument();
    expect(screen.getByText("当前先展示最近一次成功分析，新的分析完成后会自动替换下面结果。")).toBeInTheDocument();
    expect(screen.getByText("最近分析摘要")).toBeInTheDocument();
  });

  it("keeps the latest successful analysis visible when a refresh attempt fails", async () => {
    const snapshot = mockPageSnapshot("workbench");
    const failed = structuredClone(snapshot);
    failed.analysisJob = {
      id: "job-3",
      status: "failed",
      title: "分析失败",
      message: "分析超时：002463，请缩减分析师范围或稍后重试。",
      symbol: "002463",
    };
    failed.analysis.generatedAt = "2026-04-15T10:41:20.634856";
    const client: ApiClient = {
      baseUrl: "/api",
      mode: "mock",
      getPageSnapshot: vi.fn(async () => failed) as unknown as ApiClient["getPageSnapshot"],
      runPageAction: vi.fn(async () => failed) as unknown as ApiClient["runPageAction"],
      getTaskStatus: createTaskStatusMock(),
    };

    render(
      <MemoryRouter>
        <WorkbenchPage client={client} />
      </MemoryRouter>,
    );

    const analysisHeading = await screen.findByRole("heading", { name: "股票分析" });
    const analysisCard = analysisHeading.closest("section");
    expect(analysisCard).toBeTruthy();
    const analysisSection = within(analysisCard as HTMLElement);
    expect(analysisSection.getByText("最近一次刷新失败")).toBeInTheDocument();
    expect(analysisSection.getByText(/当前显示的是最近一次成功分析/)).toBeInTheDocument();
    expect(analysisSection.getAllByText(/生成时间：2026-04-15T10:41:20.634856/).length).toBeGreaterThan(0);
    expect(analysisSection.getByText(/分析超时：002463/)).toBeInTheDocument();
    expect(analysisSection.getByText("最近分析摘要")).toBeInTheDocument();
  });

  it("shows stage states for discussion and decision while keeping previous analysis visible", async () => {
    const snapshot = mockPageSnapshot("workbench");
    snapshot.analysis.generatedAt = "2026-04-15T10:41:20.634856";
    const queued = structuredClone(snapshot);
    queued.analysisJob = {
      id: "job-4",
      status: "running",
      title: "分析进行中",
      message: "正在组织团队讨论",
      stage: "discussion",
      progress: 78,
      symbol: "002463",
      startedAt: "2026-04-15T10:45:20.634856",
      updatedAt: "2026-04-15T10:45:25.634856",
    };
    const client: ApiClient = {
      baseUrl: "/api",
      mode: "mock",
      getPageSnapshot: vi.fn(async () => snapshot) as unknown as ApiClient["getPageSnapshot"],
      runPageAction: vi.fn(async () => queued) as unknown as ApiClient["runPageAction"],
      getTaskStatus: createTaskStatusMock(),
    };

    render(
      <MemoryRouter>
        <WorkbenchPage client={client} />
      </MemoryRouter>,
    );

    const analysisHeading = await screen.findByRole("heading", { name: "股票分析" });
    const analysisCard = analysisHeading.closest("section");
    expect(analysisCard).toBeTruthy();
    const analysisSection = within(analysisCard as HTMLElement);

    fireEvent.change(analysisSection.getByLabelText("股票代码 / 批量代码"), { target: { value: "002463" } });
    fireEvent.click(analysisSection.getByRole("button", { name: "分析" }));

    expect(await screen.findByText("本轮分析进度")).toBeInTheDocument();
    expect(screen.getByText("正在组织团队讨论")).toBeInTheDocument();
    expect(screen.getByText("生成时间：2026-04-15T10:41:20.634856")).toBeInTheDocument();
    expect(screen.getAllByText("已完成").length).toBeGreaterThan(0);
    expect(screen.getByText("进行中")).toBeInTheDocument();
    expect(screen.getByText("等待上一步完成")).toBeInTheDocument();
  });

  it("polls workbench analysis jobs until the result completes", async () => {
    const queued = mockPageSnapshot("workbench");
    queued.analysisJob = {
      id: "job-1",
      status: "running",
      title: "分析进行中",
      message: "正在获取行情与财务数据",
      stage: "enrich",
      progress: 18,
      symbol: "002463",
    };
    const completed = structuredClone(queued);
    completed.analysisJob = {
      id: "job-1",
      status: "completed",
      title: "分析已完成",
      message: "沪电股份 的分析结果已生成。",
      symbol: "002463",
    };
    completed.analysis.summaryTitle = "沪电股份 分析摘要";

    const getPageSnapshot = vi
      .fn()
      .mockResolvedValueOnce(queued)
      .mockResolvedValueOnce(completed);
    const runPageAction = vi.fn(async () => queued);

    const client: ApiClient = {
      baseUrl: "/api",
      mode: "mock",
      getPageSnapshot: getPageSnapshot as unknown as ApiClient["getPageSnapshot"],
      runPageAction: runPageAction as unknown as ApiClient["runPageAction"],
      getTaskStatus: createTaskStatusMock(),
    };

    render(
      <MemoryRouter>
        <WorkbenchPage client={client} />
      </MemoryRouter>,
    );

    const analysisHeading = await screen.findByRole("heading", { name: "股票分析" });
    const analysisCard = analysisHeading.closest("section");
    expect(analysisCard).toBeTruthy();
    const analysisSection = within(analysisCard as HTMLElement);

    fireEvent.change(analysisSection.getByLabelText("股票代码 / 批量代码"), { target: { value: "002463" } });
    fireEvent.click(analysisSection.getByRole("button", { name: "分析" }));

    expect(await screen.findByText("本轮分析进度")).toBeInTheDocument();
    expect(screen.getByText("正在获取行情与财务数据")).toBeInTheDocument();

    await waitFor(() => {
      expect(getPageSnapshot).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("本轮分析进度")).not.toBeInTheDocument();
    }, { timeout: 4000 });
    expect(screen.getByText("沪电股份 分析摘要")).toBeInTheDocument();
  }, 10000);

  it("dispatches watchlist actions and exposes next-step navigation", async () => {
    const { client, runPageAction } = createClient();

    render(
      <MemoryRouter>
        <WorkbenchPage client={client} />
      </MemoryRouter>,
    );

    const watchlistHeading = await screen.findByRole("heading", { name: "我的关注" });
    const watchlistSection = watchlistHeading.closest("section");
    expect(watchlistSection).toBeTruthy();

    const watchlist = within(watchlistSection as HTMLElement);

    fireEvent.change(watchlist.getByLabelText("股票代码"), { target: { value: "300750" } });
    fireEvent.click(watchlist.getByRole("button", { name: "添加" }));
    expect(runPageAction).toHaveBeenCalledWith("workbench", "add-watchlist", { code: "300750" });

    const toolbar = watchlist.getByTestId("watchlist-toolbar");
    expect(within(toolbar).getByTestId("watchlist-toolbar-actions")).toBeInTheDocument();
    expect(within(toolbar).getByTestId("watchlist-toolbar-status")).toBeInTheDocument();

    const watchlistTable = watchlist.getByTestId("watchlist-table");
    const colgroup = watchlistTable.querySelector("colgroup");
    expect(colgroup).toBeTruthy();
    expect(colgroup?.querySelectorAll("col")).toHaveLength(8);

    fireEvent.click(watchlist.getByLabelText("选择 明阳电气"));
    fireEvent.click(watchlist.getByRole("button", { name: "加入量化候选" }));
    expect(runPageAction).toHaveBeenCalledWith("workbench", "batch-quant", { codes: ["301291"] });

    fireEvent.click(watchlist.getByRole("button", { name: "分析 301291" }));
    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith(
        "workbench",
        "analysis",
        expect.objectContaining({
          stockCode: "301291",
          analysts: expect.arrayContaining(["technical", "fundamental", "fund_flow", "risk"]),
        }),
      );
    });

    const nextStepsHeading = screen.getByRole("heading", { name: "下一步" });
    const nextStepsSection = nextStepsHeading.closest("section");
    expect(nextStepsSection).toBeTruthy();

    const nextSteps = within(nextStepsSection as HTMLElement);
    expect(nextSteps.getByRole("link", { name: /发现股票/ })).toHaveAttribute("href", "/discover");
    expect(nextSteps.getByRole("link", { name: /研究情报/ })).toHaveAttribute("href", "/research");
    expect(nextSteps.getByRole("link", { name: /量化模拟/ })).toHaveAttribute("href", "/live-sim");
  });

  it("shows a 50-row watchlist page with search and bottom pagination controls", async () => {
    const snapshot = mockPageSnapshot("workbench");
    snapshot.watchlist.rows = buildWatchlistRows(60);
    snapshot.watchlist.emptyLabel = "暂无关注股票。";
    const runPageAction = vi.fn(async () => snapshot);
    const client: ApiClient = {
      baseUrl: "/api",
      mode: "mock",
      getPageSnapshot: vi.fn(async () => snapshot) as unknown as ApiClient["getPageSnapshot"],
      runPageAction: runPageAction as unknown as ApiClient["runPageAction"],
      getTaskStatus: createTaskStatusMock(),
    };

    render(
      <MemoryRouter>
        <WorkbenchPage client={client} />
      </MemoryRouter>,
    );

    const watchlistHeading = await screen.findByRole("heading", { name: "我的关注" });
    const watchlistSection = watchlistHeading.closest("section");
    expect(watchlistSection).toBeTruthy();

    const watchlist = within(watchlistSection as HTMLElement);
    const searchInput = watchlist.getByLabelText("搜索股票");
    expect(searchInput).toBeInTheDocument();

    const table = watchlist.getByTestId("watchlist-table");
    const body = table.querySelector("tbody");
    expect(body).toBeTruthy();
    expect(within(body as HTMLElement).getAllByRole("row")).toHaveLength(50);

    const pagination = watchlist.getByTestId("watchlist-pagination");
    expect(table.compareDocumentPosition(pagination) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(pagination).getByRole("button", { name: "2" })).toBeInTheDocument();

    fireEvent.click(within(pagination).getByRole("button", { name: "2" }));
    expect(within(body as HTMLElement).getAllByRole("row")).toHaveLength(10);
    expect(watchlist.getByText("贵州茅台")).toBeInTheDocument();
  });
});
