import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HisReplayPage } from "../features/quant/his-replay-page";
import { LiveSimPage } from "../features/quant/live-sim-page";
import type { ApiClient } from "../lib/api-client";
import { mockPageSnapshot } from "../lib/mock-backend";
import type { PageKey, PageSnapshotMap, TableRow } from "../lib/page-models";

const clone = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const makeMutableClient = (page: PageKey, initialSnapshot?: PageSnapshotMap[PageKey]) => {
  let snapshot: any = clone(initialSnapshot ?? mockPageSnapshot(page));
  const getPageSnapshot = vi.fn(async () => clone(snapshot));
  const runPageAction = vi.fn(async (_page: PageKey, action: string, payload?: unknown) => {
    const next = clone(snapshot);

    if (page === "live-sim") {
      if (action === "stop") {
        next.status.running = "已停止";
      }
      if (action === "start") {
        next.status.running = "运行中";
      }
      if (action === "delete-candidate") {
        const code = typeof payload === "string" ? payload : typeof payload === "object" && payload ? String((payload as { code?: unknown }).code ?? "") : "";
        next.candidatePool.rows = next.candidatePool.rows.filter((row: TableRow) => row.id !== code);
      }
      snapshot = next;
      return clone(snapshot);
    }

    if (page === "his-replay") {
      if (action === "start" || action === "continue") {
        next.tasks = [
          ...next.tasks,
          {
            id: "#11",
            status: action === "start" ? "running" : "queued",
            range: "2026-04-01 -> now",
            note: action === "start" ? "新回放任务已创建" : "接续任务已排队",
          },
        ];
      }
      if (action === "cancel") {
        next.tasks = next.tasks.map((task: (typeof next.tasks)[number]) =>
          task.id === "#10" ? { ...task, status: "cancelled", note: "任务已取消" } : task,
        );
      }
      if (action === "delete") {
        next.tasks = next.tasks.filter((task: (typeof next.tasks)[number]) => task.id !== "#10");
      }
      snapshot = next;
      return clone(snapshot);
    }

    snapshot = next;
    return clone(snapshot);
  });

  const client = {
    baseUrl: "/api",
    mode: "mock",
    getPageSnapshot,
    runPageAction,
  } as unknown as ApiClient;

  return { client, getPageSnapshot, runPageAction };
};

describe("ui quant pages", () => {
  it("renders live-sim sections and wires candidate pool actions", async () => {
    const { client, runPageAction } = makeMutableClient("live-sim");

    render(<LiveSimPage client={client} />);

    expect(await screen.findByRole("heading", { name: "量化模拟" })).toBeInTheDocument();
    expect(screen.getByText("快照 2026-04-13 10:35")).toBeInTheDocument();
    expect(screen.getAllByText("候选 7").length).toBeGreaterThan(0);
    expect(screen.getAllByText("运行中").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 2, name: "定时任务配置" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "量化候选池" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "执行中心" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "账户结果" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "当前持仓" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "成交记录" })).toBeInTheDocument();
    expect(screen.getByText("表内 3 只")).toBeInTheDocument();
    expect(screen.getByText("待量化 7")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "批量量化候选池" }));
    expect(runPageAction).toHaveBeenCalledWith("live-sim", "bulk-quant", {
      codes: ["301307", "300390", "002824"],
    });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    fireEvent.click(screen.getByRole("button", { name: "启动模拟" }));
    fireEvent.click(screen.getByRole("button", { name: "停止模拟" }));
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
      expect(runPageAction).toHaveBeenCalledWith("live-sim", "stop", undefined);
    });
    expect(screen.getAllByText("已停止").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "删除" })[0]);
    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith("live-sim", "delete-candidate", "301307");
    });
    expect(screen.queryByText("301307")).not.toBeInTheDocument();
  });

  it("saves live-sim scheduler settings with explicit payloads", async () => {
    const { client, runPageAction } = makeMutableClient("live-sim");

    render(<LiveSimPage client={client} />);

    expect(await screen.findByRole("heading", { name: "量化模拟" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("间隔(分钟)"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("分析粒度"), { target: { value: "1d" } });
    fireEvent.change(screen.getByLabelText("策略模式"), { target: { value: "defensive" } });
    fireEvent.change(screen.getByLabelText("市场"), { target: { value: "US" } });
    fireEvent.click(screen.getByLabelText("自动执行模拟交易"));
    fireEvent.change(screen.getByLabelText("初始资金池(元)"), { target: { value: "200000" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    fireEvent.click(screen.getByRole("button", { name: "启动模拟" }));
    fireEvent.click(screen.getByRole("button", { name: "重置" }));

    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith(
        "live-sim",
        "save",
        expect.objectContaining({
          intervalMinutes: 20,
          analysisTimeframe: "1d",
          strategyMode: "defensive",
          market: "US",
          autoExecute: false,
        }),
      );
      expect(runPageAction).toHaveBeenCalledWith(
        "live-sim",
        "start",
        expect.objectContaining({
          intervalMinutes: 20,
          analysisTimeframe: "1d",
          strategyMode: "defensive",
          market: "US",
          autoExecute: false,
        }),
      );
      expect(runPageAction).toHaveBeenCalledWith("live-sim", "reset", expect.objectContaining({ initialCash: 200000 }));
    });
  });

  it("shows live-sim empty states from the current snapshot structure", async () => {
    const snapshot = mockPageSnapshot("live-sim");
    render(
      <LiveSimPage
        client={
          {
            baseUrl: "/api",
            mode: "mock",
            getPageSnapshot: async () =>
              ({
                ...snapshot,
                candidatePool: {
                  ...snapshot.candidatePool,
                  rows: [],
                  emptyLabel: "候选池空",
                  emptyMessage: "先从我的关注推进候选，再触发模拟。",
                },
                pendingSignals: [],
                holdings: {
                  ...snapshot.holdings,
                  rows: [],
                  emptyLabel: "持仓空",
                  emptyMessage: "当前模拟账户还没有形成持仓。",
                },
                trades: {
                  ...snapshot.trades,
                  rows: [],
                  emptyLabel: "成交空",
                  emptyMessage: "还没有生成新的模拟成交。",
                },
              }) as typeof snapshot,
            runPageAction: vi.fn(async () => snapshot),
          } as unknown as ApiClient
        }
      />,
    );

    expect(await screen.findByRole("heading", { name: "量化模拟" })).toBeInTheDocument();
    expect(screen.getByText("候选池空")).toBeInTheDocument();
    expect(screen.getByText("先从我的关注推进候选，再触发模拟。")).toBeInTheDocument();
    expect(screen.getByText("暂无待执行信号")).toBeInTheDocument();
    expect(screen.getByText("持仓空")).toBeInTheDocument();
    expect(screen.getByText("成交空")).toBeInTheDocument();
  });

  it("renders his-replay sections and updates the task list when replay starts", async () => {
    const { client, runPageAction } = makeMutableClient("his-replay");

    render(<HisReplayPage client={client} />);

    expect(await screen.findByRole("heading", { name: "历史回放" })).toBeInTheDocument();
    expect(screen.getByText("快照 2026-04-13 10:35")).toBeInTheDocument();
    expect(screen.getByText("任务 2")).toBeInTheDocument();
    expect(screen.getAllByText("进行中 1").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 2, name: "回放配置" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "量化候选池" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "回放任务" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "交易分析" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "资金曲线" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "结束持仓" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "成交明细" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "信号记录" })).toBeInTheDocument();
    expect(screen.getByText("表内 3 只")).toBeInTheDocument();
    expect(screen.getByText("已完成 1")).toBeInTheDocument();
    expect(screen.getByText("排队 0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "回放" }));
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
    });

    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith("his-replay", "cancel", undefined);
    });
    expect(await screen.findByText("cancelled")).toBeInTheDocument();
  });

  it("saves his-replay run settings with explicit payloads", async () => {
    const { client, runPageAction } = makeMutableClient("his-replay");

    render(<HisReplayPage client={client} />);

    expect(await screen.findByRole("heading", { name: "历史回放" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("回放模式"), { target: { value: "continuous_to_live" } });
    fireEvent.change(screen.getByLabelText("开始日期"), { target: { value: "2026-03-11" } });
    fireEvent.change(screen.getByLabelText("结束日期"), { target: { value: "2026-04-10" } });
    fireEvent.change(screen.getByLabelText("开始时间"), { target: { value: "09:30" } });
    fireEvent.change(screen.getByLabelText("结束时间"), { target: { value: "15:00" } });
    fireEvent.change(screen.getByLabelText("回放粒度"), { target: { value: "1d" } });
    fireEvent.change(screen.getByLabelText("市场"), { target: { value: "HK" } });
    fireEvent.change(screen.getByLabelText("策略模式"), { target: { value: "defensive" } });
    fireEvent.click(screen.getByLabelText("覆盖当前实时模拟账户"));
    fireEvent.click(screen.getByRole("button", { name: "接续" }));

    await waitFor(() => {
      expect(runPageAction).toHaveBeenCalledWith(
        "his-replay",
        "continue",
        expect.objectContaining({
          startDateTime: "2026-03-11 09:30:00",
          endDateTime: "2026-04-10 15:00:00",
          timeframe: "1d",
          market: "HK",
          strategyMode: "defensive",
          overwriteLive: true,
          autoStartScheduler: true,
        }),
      );
    });
  });

  it("shows his-replay empty states for candidate pool, tasks and results", async () => {
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
                candidatePool: {
                  ...snapshot.candidatePool,
                  rows: [],
                  emptyLabel: "候选池空",
                  emptyMessage: "先补入候选，再重新发起回放。",
                },
                tasks: [],
                holdings: {
                  ...snapshot.holdings,
                  rows: [],
                  emptyLabel: "持仓空",
                  emptyMessage: "回放结束后会在这里显示最终持仓。",
                },
                trades: {
                  ...snapshot.trades,
                  rows: [],
                  emptyLabel: "成交空",
                  emptyMessage: "回放成交明细还没有生成。",
                },
                signals: {
                  ...snapshot.signals,
                  rows: [],
                  emptyLabel: "信号空",
                  emptyMessage: "回放信号会在这里保留。",
                },
              }) as typeof snapshot,
            runPageAction: vi.fn(async () => snapshot),
          } as unknown as ApiClient
        }
      />,
    );

    expect(await screen.findByRole("heading", { name: "历史回放" })).toBeInTheDocument();
    expect(screen.getByText("候选池空")).toBeInTheDocument();
    expect(screen.getByText("先补入候选，再重新发起回放。")).toBeInTheDocument();
    expect(screen.getByText("暂无回放任务")).toBeInTheDocument();
    expect(screen.getByText("持仓空")).toBeInTheDocument();
    expect(screen.getByText("成交空")).toBeInTheDocument();
    expect(screen.getByText("信号空")).toBeInTheDocument();
  });
});
