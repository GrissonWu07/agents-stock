import { render, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../lib/api-client";
import { WorkbenchPage } from "../features/workbench/workbench-page";

const workbenchSnapshot = {
  updatedAt: "2026-04-25 10:00:00",
  metrics: [],
  watchlist: {
    columns: ["代码", "名称", "价格", "行业", "状态", "量化状态"],
    rows: [
      {
        id: "600519",
        cells: ["600519", "贵州茅台", "1453.96", "白酒", "待分析", "未加入"],
        actions: [],
      },
    ],
    emptyLabel: "关注池为空",
    pagination: { page: 1, pageSize: 20, totalRows: 1, totalPages: 1 },
  },
  watchlistMeta: {
    selectedCount: 0,
    quantCount: 0,
    refreshHint: "刷新关注池",
  },
  analysis: {
    symbol: "600519",
    stockName: "贵州茅台",
    analysts: [
      { label: "技术分析师", value: "technical", selected: true },
      { label: "基本面分析师", value: "fundamental", selected: true },
    ],
    mode: "单个分析",
    cycle: "1y",
    inputHint: "600519",
    summaryTitle: "最近分析",
    summaryBody: "暂无新分析。",
    indicators: [],
    decision: "观察",
    insights: [],
    analystViews: [],
    curve: [],
    results: [],
  },
  analysisJob: null,
  nextSteps: [],
  activity: [],
};

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "(max-width: 1200px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderWorkbenchPage(client: ApiClient) {
  const router = createMemoryRouter([{ path: "/workbench", element: <WorkbenchPage client={client} /> }], {
    initialEntries: ["/workbench"],
  });
  render(<RouterProvider router={router} />);
}

describe("WorkbenchPage", () => {
  it("requests watchlist table data with a maximum page size of 20", async () => {
    const getPageSnapshot = vi.fn().mockResolvedValue(workbenchSnapshot);
    const client = {
      getPageSnapshot,
      runPageAction: vi.fn().mockResolvedValue(workbenchSnapshot),
    } as unknown as ApiClient;

    renderWorkbenchPage(client);

    await waitFor(() => {
      expect(getPageSnapshot).toHaveBeenCalledWith("workbench", { search: "", page: 1, pageSize: 20 });
    });
  });

  it("limits watchlist pagination to 10 page buttons and uses ellipsis for the rest", async () => {
    const pagedSnapshot = {
      ...workbenchSnapshot,
      watchlist: {
        ...workbenchSnapshot.watchlist,
        pagination: { page: 1, pageSize: 20, totalRows: 240, totalPages: 12 },
      },
    };
    const getPageSnapshot = vi.fn().mockResolvedValue(pagedSnapshot);
    const client = {
      getPageSnapshot,
      runPageAction: vi.fn().mockResolvedValue(pagedSnapshot),
    } as unknown as ApiClient;

    renderWorkbenchPage(client);

    await waitFor(() => {
      expect(getPageSnapshot).toHaveBeenCalledWith("workbench", { search: "", page: 1, pageSize: 20 });
    });
    expect(document.querySelectorAll(".watchlist-pagination__page")).toHaveLength(10);
    expect(document.querySelectorAll(".watchlist-pagination__ellipsis")).toHaveLength(1);

    for (let page = 1; page <= 10; page += 1) {
      expect(document.querySelector(`button.watchlist-pagination__page[aria-label="第 ${page} 页"]`)).not.toBeNull();
    }
    expect(document.querySelector(`button.watchlist-pagination__page[aria-label="第 11 页"]`)).toBeNull();
    expect(document.querySelector(`button.watchlist-pagination__page[aria-label="第 12 页"]`)).toBeNull();
  });
});
