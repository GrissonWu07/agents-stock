import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../lib/api-client";
import { WorkbenchPage } from "../features/workbench/workbench-page";
import { DiscoverPage } from "../features/discover/discover-page";
import { ResearchPage } from "../features/research/research-page";
import { mockPageSnapshot } from "./mock-backend";
import type { PageKey, PageSnapshotMap } from "../lib/page-models";

const clone = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

function createClient(page: PageKey) {
  const snapshot = clone(mockPageSnapshot(page));
  const getPageSnapshot = vi.fn(async () => clone(snapshot));
  const runPageAction = vi.fn(async (_page: PageKey, _action: string, _payload?: unknown) => clone(snapshot));

  const client = {
    baseUrl: "/api",
    mode: "mock",
    getPageSnapshot: getPageSnapshot as unknown as ApiClient["getPageSnapshot"],
    runPageAction: runPageAction as unknown as ApiClient["runPageAction"],
  } as unknown as ApiClient;

  return { client, runPageAction };
}

function createDiscoverClient(snapshot: PageSnapshotMap["discover"], runPageAction?: ApiClient["runPageAction"]) {
  const getPageSnapshot = vi.fn(async () => clone(snapshot));
  const client = {
    baseUrl: "/api",
    mode: "mock",
    getPageSnapshot: getPageSnapshot as unknown as ApiClient["getPageSnapshot"],
    runPageAction: (runPageAction ??
      (vi.fn(async () => clone(snapshot)) as unknown as ApiClient["runPageAction"])) as ApiClient["runPageAction"],
  } as unknown as ApiClient;

  return { client };
}

describe("ui workflow pages", () => {
  it("dispatches clear-selection from the workbench watchlist toolbar", async () => {
    const { client, runPageAction } = createClient("workbench");

    render(
      <MemoryRouter>
        <WorkbenchPage client={client} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "工作台" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清空选择" }));

    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith("workbench", "clear-selection", undefined);
    });
  });

  it("keeps discover batch-watchlist disabled until rows are selected", async () => {
    const { client, runPageAction } = createClient("discover");

    render(<DiscoverPage client={client} />);

    expect(await screen.findByRole("heading", { name: "发现股票" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "加入所选关注池" })).toBeDisabled();

    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    await screen.findByText("已选/候选 1 / 4");

    expect(screen.getByRole("button", { name: "加入所选关注池" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "加入所选关注池" }));

    expect(runPageAction).toHaveBeenCalledWith("discover", "batch-watchlist", { codes: ["301291"] });
  });

  it("keeps research batch-watchlist disabled until outputs are selected", async () => {
    const { client, runPageAction } = createClient("research");

    render(<ResearchPage client={client} />);

    expect(await screen.findByRole("heading", { name: "研究情报" })).toBeInTheDocument();

    expect(screen.getAllByRole("button", { name: "批量加入关注池" }).every((button) => button.hasAttribute("disabled"))).toBe(true);

    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    await screen.findByText("已选 1 只股票");

    expect(screen.getAllByRole("button", { name: "批量加入关注池" }).every((button) => !button.hasAttribute("disabled"))).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: "批量加入关注池" })[0]);

    expect(runPageAction).toHaveBeenCalledWith("research", "batch-watchlist", { codes: ["002463"] });
  });

  it("dispatches item-watchlist from discover row actions", async () => {
    const { client, runPageAction } = createClient("discover");

    render(<DiscoverPage client={client} />);

    expect(await screen.findByRole("heading", { name: "发现股票" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "加入我的关注" })[0]);

    expect(runPageAction).toHaveBeenCalledWith("discover", "item-watchlist", { code: "301291" });
  });

  it("dispatches workbench analysis from discover row actions and shows the analysis panel", async () => {
    const snapshot = clone(mockPageSnapshot("discover"));
    const workbenchSnapshot = clone(mockPageSnapshot("workbench"));
    workbenchSnapshot.analysis.generatedAt = "2026-04-15 09:45";
    workbenchSnapshot.analysis.insights = [
      { title: "操作建议", body: "若价格放量站稳，可考虑继续跟踪。", tone: "accent" },
      { title: "模型状态", body: "当前分析已完成，等待后续验证。", tone: "warning" },
      { title: "风险提示", body: "震荡区间内不建议追高。", tone: "neutral" },
    ];
    workbenchSnapshot.analysis.analystViews = [
      { title: "技术分析师", body: "技术面仍在区间内整理，先看确认信号。", tone: "neutral" },
      { title: "基本面分析师", body: "基本面没有恶化，但估值修复空间有限。", tone: "neutral" },
      { title: "资金面分析师", body: "资金流入不算强，适合等待更清晰的增量。", tone: "neutral" },
      { title: "风险管理师", body: "需要把仓位控制放在第一优先级。", tone: "warning" },
    ];
    const runPageAction = vi.fn(async (page: PageKey, action: string) => {
      if (page === "workbench" && action === "analysis") {
        return clone(workbenchSnapshot);
      }
      return clone(snapshot);
    }) as unknown as ApiClient["runPageAction"];
    const { client } = createDiscoverClient(snapshot, runPageAction);

    render(<DiscoverPage client={client} />);

    expect(await screen.findByRole("heading", { name: "发现股票" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "分析" })[0]);

    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith("workbench", "analysis", { stockCode: "301291" });
    });
    expect(await screen.findByRole("heading", { name: "股票分析" })).toBeInTheDocument();
    expect(screen.getByText(workbenchSnapshot.analysis.summaryTitle)).toBeInTheDocument();
    expect(screen.getByText(workbenchSnapshot.analysis.decision)).toBeInTheDocument();
    expect(screen.getByText("生成时间：2026-04-15 09:45")).toBeInTheDocument();
    expect(screen.getByText("风险提示")).toBeInTheDocument();
    expect(screen.getByText("技术分析师")).toBeInTheDocument();
    expect(screen.getByText("风险管理师")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "最近结果摘要" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "当前选择" })).toBeInTheDocument();
  });

  it("keeps a discover analysis placeholder visible before any candidate is analyzed", async () => {
    const { client } = createClient("discover");

    render(<DiscoverPage client={client} />);

    expect(await screen.findByRole("heading", { name: "发现股票" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "股票分析" })).toBeInTheDocument();
    expect(screen.getByText("等待分析结果")).toBeInTheDocument();
    expect(screen.getByText("点击候选表里的“分析”后，这里会展示股票分析摘要、关键指标、最终决策和分析师观点。", { selector: ".summary-item__body" })).toBeInTheDocument();
  });

  it("dispatches item-watchlist from research row actions", async () => {
    const { client, runPageAction } = createClient("research");

    render(<ResearchPage client={client} />);

    expect(await screen.findByRole("heading", { name: "研究情报" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "加入关注" })[0]);

    expect(runPageAction).toHaveBeenCalledWith("research", "item-watchlist", { code: "002463" });
  });

  it("shows discover search empty state when filters miss", async () => {
    const { client } = createClient("discover");

    render(<DiscoverPage client={client} />);

    expect(await screen.findByRole("heading", { name: "发现股票" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("输入代码、名称、行业、来源、理由或发现时间"), { target: { value: "does-not-match" } });

    expect(await screen.findByText("未找到匹配“does-not-match”的候选股票")).toBeInTheDocument();
  });

  it("shows research search empty state when filters miss", async () => {
    const { client: researchClient } = createClient("research");

    render(<ResearchPage client={researchClient} />);

    expect(await screen.findByRole("heading", { name: "研究情报" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("输入代码、名称、来源或原因"), { target: { value: "does-not-match" } });

    expect(await screen.findByText("未找到匹配“does-not-match”的股票输出")).toBeInTheDocument();
  });

  it("dispatches discover refresh semantics from the main action", async () => {
    const { client, runPageAction } = createClient("discover");

    render(<DiscoverPage client={client} />);

    expect(await screen.findByRole("heading", { name: "发现股票" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "运行策略" }));

    expect(runPageAction).toHaveBeenCalledWith("discover", "run-strategy", undefined);
  });

  it("shows loading feedback while discover run-strategy is in flight", async () => {
    let resolveAction!: (value: PageSnapshotMap["discover"]) => void;
    const pendingAction = new Promise<PageSnapshotMap["discover"]>((resolve) => {
      resolveAction = resolve;
    });
    const snapshot = clone(mockPageSnapshot("discover"));
    const runPageAction = vi.fn(async () => pendingAction) as unknown as ApiClient["runPageAction"];
    const { client } = createDiscoverClient(snapshot, runPageAction);

    render(<DiscoverPage client={client} />);

    expect(await screen.findByRole("heading", { name: "发现股票" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "运行策略" }));

    expect(await screen.findByRole("button", { name: "运行中..." })).toBeDisabled();
    expect(screen.getByText("正在刷新发现结果...")).toBeInTheDocument();

    resolveAction(snapshot);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "运行策略" })).toBeEnabled();
    });
    expect(screen.getByText("发现结果已更新，候选与摘要已同步刷新。")).toBeInTheDocument();
  });

  it("paginates discover candidate rows and keeps selection within the visible page", async () => {
    const snapshot = clone(mockPageSnapshot("discover"));
    snapshot.candidateTable.rows = Array.from({ length: 7 }, (_, index) => ({
      id: `30000${index + 1}`,
      cells: [
        `30000${index + 1}`,
        `候选${index + 1}`,
        `行业${index + 1}`,
        `来源${index + 1}`,
        `${10 + index}.00`,
        `${100 + index}`,
        `${20 + index}`,
        `${3 + index}`,
      ],
      actions: [{ label: "加入我的关注", icon: "⭐", tone: "accent" }],
    }));

    const { client } = createDiscoverClient(snapshot);

    render(<DiscoverPage client={client} />);

    expect(await screen.findByRole("heading", { name: "发现股票" })).toBeInTheDocument();
    expect(screen.getByText("已选/候选 0 / 7")).toBeInTheDocument();
    const footer = screen.getByTestId("discover-candidate-footer");
    expect(within(footer).getByText("当前第 1 / 2 页")).toBeInTheDocument();
    expect(within(footer).getByRole("button", { name: "上一页" })).toBeDisabled();
    expect(within(footer).getByRole("button", { name: "下一页" })).toBeEnabled();

    expect(screen.getByText("候选1")).toBeInTheDocument();
    expect(screen.queryByText("候选7")).not.toBeInTheDocument();

    fireEvent.click(within(footer).getByRole("button", { name: "下一页" }));

    expect(within(footer).getByText("当前第 2 / 2 页")).toBeInTheDocument();
    expect(within(footer).getByRole("button", { name: "下一页" })).toBeDisabled();
    expect(screen.getByText("候选7")).toBeInTheDocument();
    expect(screen.queryByText("候选1")).not.toBeInTheDocument();
  });

  it("shows full macro details and removes duplicate macro insight summaries", async () => {
    const snapshot = clone(mockPageSnapshot("research"));
    snapshot.modules = snapshot.modules.map((module) =>
      module.name === "宏观分析"
        ? {
            ...module,
            note: [
              "# A股后市综合报告",
              "## 当前宏观判断",
              "### 弱复苏中的结构分化",
              "总量修复偏慢，结构机会更强。",
              "### 出口链景气延续",
              "外需方向仍有支撑，景气链条仍值得跟踪。",
            ].join("\n"),
          }
        : module,
    );
    snapshot.marketView = [
      { title: "宏观分析", body: "宏观判断摘要。", tone: "neutral" },
      { title: "行业映射", body: "结构性机会。", tone: "accent" },
    ];

    const getPageSnapshot = vi.fn(async () => clone(snapshot));
    const client = {
      baseUrl: "/api",
      mode: "mock",
      getPageSnapshot: getPageSnapshot as unknown as ApiClient["getPageSnapshot"],
      runPageAction: vi.fn(async () => clone(snapshot)) as unknown as ApiClient["runPageAction"],
    } as unknown as ApiClient;

    render(<ResearchPage client={client} />);

    expect(await screen.findByRole("heading", { name: "研究情报" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /宏观分析/ }));

    expect(screen.getByText("总量修复偏慢，结构机会更强。")).toBeInTheDocument();
    expect(screen.getByText("外需方向仍有支撑，景气链条仍值得跟踪。")).toBeInTheDocument();
    expect(screen.queryByText("宏观判断摘要。")).not.toBeInTheDocument();
    expect(screen.getByText("结构性机会。")).toBeInTheDocument();
  });

  it("dispatches research refresh semantics from the main action", async () => {
    const { client, runPageAction } = createClient("research");

    render(<ResearchPage client={client} />);

    expect(await screen.findByRole("heading", { name: "研究情报" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));

    expect(runPageAction).toHaveBeenCalledWith("research", "run-module", undefined);
  });
});
