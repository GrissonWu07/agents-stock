import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { WorkbenchPage } from "../features/workbench/workbench-page";
import type { ApiClient } from "../lib/api-client";
import { mockPageSnapshot } from "../lib/mock-backend";

const createClient = () => {
  const snapshot = mockPageSnapshot("workbench");
  const runPageAction = vi.fn(async () => snapshot);

  const client: ApiClient = {
    baseUrl: "/api",
    mode: "mock",
    getPageSnapshot: vi.fn(async () => snapshot) as unknown as ApiClient["getPageSnapshot"],
    runPageAction: runPageAction as unknown as ApiClient["runPageAction"],
  };

  return { client, runPageAction };
};

describe("workbench page", () => {
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
          analysts: expect.arrayContaining(["news"]),
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

    fireEvent.click(watchlist.getByLabelText("选择 明阳电气"));
    fireEvent.click(watchlist.getByRole("button", { name: "加入量化候选" }));
    expect(runPageAction).toHaveBeenCalledWith("workbench", "batch-quant", { codes: ["301291"] });

    const nextStepsHeading = screen.getByRole("heading", { name: "下一步" });
    const nextStepsSection = nextStepsHeading.closest("section");
    expect(nextStepsSection).toBeTruthy();

    const nextSteps = within(nextStepsSection as HTMLElement);
    expect(nextSteps.getByRole("link", { name: /发现股票/ })).toHaveAttribute("href", "/discover");
    expect(nextSteps.getByRole("link", { name: /研究情报/ })).toHaveAttribute("href", "/research");
    expect(nextSteps.getByRole("link", { name: /量化模拟/ })).toHaveAttribute("href", "/live-sim");
  });
});
