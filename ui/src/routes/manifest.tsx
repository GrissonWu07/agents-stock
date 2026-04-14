import type { ReactNode } from "react";
import { WorkbenchPage } from "../features/workbench/workbench-page";
import { DiscoverPage } from "../features/discover/discover-page";
import { ResearchPage } from "../features/research/research-page";
import { PortfolioPage } from "../features/portfolio/portfolio-page";
import { LiveSimPage } from "../features/quant/live-sim-page";
import { HisReplayPage } from "../features/quant/his-replay-page";
import { AiMonitorPage } from "../features/monitor/ai-monitor-page";
import { RealMonitorPage } from "../features/monitor/real-monitor-page";
import { HistoryPage } from "../features/history/history-page";
import { SettingsPage } from "../features/settings/settings-page";

export type AppRouteItem = {
  path: string;
  label: string;
  group: string;
  element: ReactNode;
};

export const APP_ROUTE_ITEMS: AppRouteItem[] = [
  { path: "/main", label: "工作台", group: "工作台", element: <WorkbenchPage /> },
  { path: "/discover", label: "发现股票", group: "发现与情报", element: <DiscoverPage /> },
  { path: "/research", label: "研究情报", group: "发现与情报", element: <ResearchPage /> },
  { path: "/portfolio", label: "持仓分析", group: "投资管理", element: <PortfolioPage /> },
  { path: "/live-sim", label: "量化模拟", group: "投资管理", element: <LiveSimPage /> },
  { path: "/his-replay", label: "历史回放", group: "投资管理", element: <HisReplayPage /> },
  { path: "/ai-monitor", label: "AI盯盘", group: "投资管理", element: <AiMonitorPage /> },
  { path: "/real-monitor", label: "实时监控", group: "投资管理", element: <RealMonitorPage /> },
  { path: "/history", label: "历史记录", group: "系统", element: <HistoryPage /> },
  { path: "/settings", label: "环境配置", group: "系统", element: <SettingsPage /> },
];

export const APP_ROUTE_LABELS = Object.fromEntries(
  APP_ROUTE_ITEMS.map((item) => [item.path, item.label]),
) as Record<string, string>;
