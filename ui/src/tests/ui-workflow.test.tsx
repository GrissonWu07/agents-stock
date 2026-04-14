import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../lib/api-client";
import { WorkbenchPage } from "../features/workbench/workbench-page";
import { DiscoverPage } from "../features/discover/discover-page";
import { ResearchPage } from "../features/research/research-page";
import { mockPageSnapshot } from "../lib/mock-backend";
import type { PageKey } from "../lib/page-models";

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

  const client: ApiClient = {
    baseUrl: "/api",
    mode: "mock",
    getPageSnapshot: getPageSnapshot as unknown as ApiClient["getPageSnapshot"],
    runPageAction: runPageAction as unknown as ApiClient["runPageAction"],
  };

  return { client, runPageAction };
}

describe("ui workflow pages", () => {
  it("dispatches clear-selection from the workbench watchlist toolbar", async () => {
    const { client, runPageAction } = createClient("workbench");

    render(
      <MemoryRouter>
        <WorkbenchPage client={client} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "玄武AI智能体股票团队分析系统" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清空选择" }));

    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith("workbench", "clear-selection", undefined);
    });
  });

  it("keeps discover batch-watchlist disabled until rows are selected", async () => {
    const { client, runPageAction } = createClient("discover");

    render(<DiscoverPage client={client} />);

    expect(await screen.findByRole("heading", { name: "发现股票" })).toBeInTheDocument();

    expect(screen.getAllByRole("button", { name: "批量加入关注池" }).every((button) => button.hasAttribute("disabled"))).toBe(true);

    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    await screen.findByText("已选 1 只股票");

    expect(screen.getAllByRole("button", { name: "批量加入关注池" }).every((button) => !button.hasAttribute("disabled"))).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: "批量加入关注池" })[0]);

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

    fireEvent.change(screen.getByPlaceholderText("输入代码、名称、行业、来源或理由"), { target: { value: "does-not-match" } });

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

  it("dispatches research refresh semantics from the main action", async () => {
    const { client, runPageAction } = createClient("research");

    render(<ResearchPage client={client} />);

    expect(await screen.findByRole("heading", { name: "研究情报" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));

    expect(runPageAction).toHaveBeenCalledWith("research", "run-module", undefined);
  });
});
