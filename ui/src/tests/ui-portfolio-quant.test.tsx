import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StrategyNarrativeCard } from "../components/ui/strategy-narrative";
import { PortfolioPage } from "../features/portfolio/portfolio-page";
import { HisReplayPage } from "../features/quant/his-replay-page";
import { LiveSimPage } from "../features/quant/live-sim-page";
import type { ApiClient } from "../lib/api-client";
import { mockPageSnapshot } from "./mock-backend";
import type { PageKey, PageSnapshotMap, TableRow } from "../lib/page-models";

const clone = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const makeClient = <K extends PageKey>(page: K, snapshot?: PageSnapshotMap[K]) => {
  const current = clone(snapshot ?? mockPageSnapshot(page));
  const runPageAction = vi.fn(async () => clone(current));

  return {
    client: {
      baseUrl: "/api",
      mode: "mock",
      getPageSnapshot: async () => clone(current),
      runPageAction,
    } as unknown as ApiClient,
    runPageAction,
  };
};

describe("ui portfolio and quant pages", () => {
  it("renders the strategy narrative card with readable evidence", () => {
    render(
      <StrategyNarrativeCard
        title="策略解释"
        summary="围绕共享候选池给出量化说明。"
        recommendation="继续观察执行结果。"
        reasons={["策略模式 自动", "分析粒度 30m"]}
        evidence={[
          { label: "间隔", value: "10m" },
          { label: "市场", value: "A股" },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "策略解释" })).toBeInTheDocument();
    expect(screen.getByText("围绕共享候选池给出量化说明。")).toBeInTheDocument();
    expect(screen.getByText("继续观察执行结果。")).toBeInTheDocument();
    expect(screen.getByText("策略模式 自动")).toBeInTheDocument();
    expect(screen.getByText("间隔：10m")).toBeInTheDocument();
    expect(screen.getByText("市场：A股")).toBeInTheDocument();
  });

  it("wires portfolio refresh, schedule and row actions to the backend", async () => {
    const { client, runPageAction } = makeClient("portfolio");
    render(<PortfolioPage client={client} />);

    expect(await screen.findByRole("heading", { name: "持仓分析" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "刷新组合" }));
    fireEvent.click(screen.getByRole("button", { name: "保存调度" }));
    fireEvent.click(screen.getByRole("button", { name: "启动调度" }));
    fireEvent.click(screen.getByRole("button", { name: "停止调度" }));
    fireEvent.click(screen.getAllByRole("button", { name: /分析/ })[0]);

    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith("portfolio", "refresh-portfolio", undefined);
      expect(runPageAction).toHaveBeenCalledWith(
        "portfolio",
        "schedule-save",
        expect.objectContaining({
          scheduleTime: "09:30",
          analysisMode: "sequential",
          maxWorkers: 1,
          autoSyncMonitor: true,
          sendNotification: true,
        }),
      );
      expect(runPageAction).toHaveBeenCalledWith("portfolio", "schedule-start", undefined);
      expect(runPageAction).toHaveBeenCalledWith("portfolio", "schedule-stop", undefined);
      expect(runPageAction).toHaveBeenCalledWith("portfolio", "analyze", "002463");
    });
  });

  it("saves portfolio scheduler settings with the backend payload", async () => {
    const { client, runPageAction } = makeClient("portfolio");
    render(<PortfolioPage client={client} />);

    expect(await screen.findByRole("heading", { name: "持仓分析" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("定时执行时间"), { target: { value: "09:45" } });
    fireEvent.change(screen.getByLabelText("分析模式"), { target: { value: "parallel" } });
    fireEvent.change(screen.getByLabelText("并行线程数"), { target: { value: "4" } });
    fireEvent.click(screen.getByLabelText("自动同步到监测"));
    fireEvent.click(screen.getByLabelText("发送完成通知"));
    fireEvent.click(screen.getByRole("button", { name: "保存调度" }));

    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith(
        "portfolio",
        "schedule-save",
        expect.objectContaining({
          scheduleTime: "09:45",
          analysisMode: "parallel",
          maxWorkers: 4,
          autoSyncMonitor: false,
          sendNotification: false,
        }),
      );
    });
  });

  it("shows portfolio empty states when holdings and actions disappear", async () => {
    const snapshot = mockPageSnapshot("portfolio");
    render(
      <PortfolioPage
        client={
          {
            baseUrl: "/api",
            mode: "mock",
            getPageSnapshot: async () =>
              ({
                ...snapshot,
                holdings: { ...snapshot.holdings, rows: [] },
                attribution: [],
                actions: [],
              }) as typeof snapshot,
            runPageAction: vi.fn(async () => snapshot),
          } as unknown as ApiClient
        }
      />,
    );

    expect(await screen.findByRole("heading", { name: "持仓分析" })).toBeInTheDocument();
    expect(screen.getByText("当前没有持仓明细")).toBeInTheDocument();
    expect(screen.getByText("收益归因暂无数据")).toBeInTheDocument();
    expect(screen.getByText("组合动作暂无数据")).toBeInTheDocument();
  });

  it("wires live-sim controls and row actions to the backend", async () => {
    const { client, runPageAction } = makeClient("live-sim");
    render(<LiveSimPage client={client} />);

    expect(await screen.findByRole("heading", { name: "量化模拟" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "策略解释" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "量化候选池" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "账户结果" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    fireEvent.click(screen.getByRole("button", { name: "停止模拟" }));
    fireEvent.click(screen.getByRole("button", { name: "启动模拟" }));
    fireEvent.click(screen.getByRole("button", { name: "批量量化候选池" }));
    fireEvent.click(screen.getAllByRole("button", { name: /分析/ })[0]);

    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith(
        "live-sim",
        "save",
        expect.objectContaining({
          intervalMinutes: 15,
          analysisTimeframe: "30m",
          strategyMode: "auto",
          market: "CN",
          autoExecute: true,
        }),
      );
      expect(runPageAction).toHaveBeenCalledWith("live-sim", "reset", expect.objectContaining({ initialCash: 100000 }));
      expect(runPageAction).toHaveBeenCalledWith("live-sim", "stop", undefined);
      expect(runPageAction).toHaveBeenCalledWith(
        "live-sim",
        "start",
        expect.objectContaining({
          intervalMinutes: 15,
          analysisTimeframe: "30m",
          strategyMode: "auto",
          market: "CN",
          autoExecute: true,
        }),
      );
      expect(runPageAction).toHaveBeenCalledWith("live-sim", "bulk-quant", {
        codes: ["301307", "300390", "002824"],
      });
      expect(runPageAction).toHaveBeenCalledWith("live-sim", "analyze-candidate", "301307");
    });
  });

  it("renders his-replay strategy narrative and real replay actions", async () => {
    const { client, runPageAction } = makeClient("his-replay");
    render(<HisReplayPage client={client} />);

    expect(await screen.findByRole("heading", { name: "历史回放" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "回放结论" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "回放任务" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "信号记录" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "回放" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    fireEvent.click(screen.getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith(
        "his-replay",
        "start",
        expect.objectContaining({
          startDateTime: "2026-03-11 09:30:00",
          endDateTime: "2026-04-10 15:00:00",
          timeframe: "30m",
          market: "CN",
          strategyMode: "auto",
        }),
      );
      expect(runPageAction).toHaveBeenCalledWith("his-replay", "cancel", undefined);
      expect(runPageAction).toHaveBeenCalledWith("his-replay", "delete", undefined);
    });
  });

  it("shows his-replay empty states when the replay snapshot is sparse", async () => {
    const snapshot = mockPageSnapshot("his-replay");
    render(
      <HisReplayPage
        client={
          {
            baseUrl: "/api",
            mode: "mock",
            getPageSnapshot: async () =>
              ({
                ...snapshot,
                candidatePool: { ...snapshot.candidatePool, rows: [] },
                tasks: [],
                holdings: { ...snapshot.holdings, rows: [] },
                trades: { ...snapshot.trades, rows: [] },
                signals: { ...snapshot.signals, rows: [] },
              }) as typeof snapshot,
            runPageAction: vi.fn(async () => snapshot),
          } as unknown as ApiClient
        }
      />,
    );

    expect(await screen.findByRole("heading", { name: "历史回放" })).toBeInTheDocument();
    expect(screen.getByText("暂无回放任务")).toBeInTheDocument();
    expect(screen.getByText("候选池暂无数据")).toBeInTheDocument();
    expect(screen.getByText("结束持仓暂无数据")).toBeInTheDocument();
    expect(screen.getByText("成交明细暂无数据")).toBeInTheDocument();
    expect(screen.getByText("信号记录暂无数据")).toBeInTheDocument();
  });
});
