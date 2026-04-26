import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../lib/api-client";
import { HistoryPage } from "../features/history/history-page";

const historySnapshot = {
  updatedAt: "2026-04-26 11:20:00",
  metrics: [],
  records: {
    columns: ["时间", "股票", "模式", "结论"],
    rows: [
      {
        id: "1",
        cells: ["2026-04-26 10:00:00", "贵州茅台", "1y", "BUY"],
        code: "600519",
        name: "贵州茅台",
      },
    ],
    emptyLabel: "暂无分析记录",
    pagination: {
      page: 1,
      pageSize: 50,
      totalRows: 1,
      totalPages: 1,
    },
  },
  recentReplay: {
    title: "暂无最近回放",
    body: "当前还没有可展示的回放记录。",
    tags: [],
  },
  curve: [],
  timeline: [],
};

function renderHistoryPage(client: ApiClient) {
  const router = createMemoryRouter(
    [
      { path: "/history", element: <HistoryPage client={client} /> },
      { path: "/portfolio/position/:symbol", element: <div data-testid="stock-detail-page" /> },
    ],
    { initialEntries: ["/history"] },
  );
  render(<RouterProvider router={router} />);
}

describe("HistoryPage", () => {
  it("links stock references in the history table to the stock detail page", async () => {
    const client = {
      getPageSnapshot: vi.fn().mockResolvedValue(historySnapshot),
      runPageAction: vi.fn().mockResolvedValue(historySnapshot),
    } as unknown as ApiClient;

    renderHistoryPage(client);

    expect(await screen.findByRole("link", { name: "贵州茅台" })).toHaveAttribute("href", "/portfolio/position/600519");
  });
});
