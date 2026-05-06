import type { ReactNode } from "react";
import { WorkbenchPage } from "../features/workbench/workbench-page";
import { DiscoverPage } from "../features/discover/discover-page";
import { ResearchPage } from "../features/research/research-page";
import { PortfolioPage } from "../features/portfolio/portfolio-page";
import { LiveSimPage } from "../features/quant/live-sim-page";
import { HisReplayPage } from "../features/quant/his-replay-page";
import { RealMonitorPage } from "../features/monitor/real-monitor-page";
import { SettingsPage } from "../features/settings/settings-page";
import { StrategyConfigPage } from "../features/settings/strategy-config-page";

export type AppRouteItem = {
  path: string;
  labelKey: string;
  groupKey: string;
  element: ReactNode;
  hidden?: boolean;
};

export const APP_ROUTE_ITEMS: AppRouteItem[] = [
  { path: "/main", labelKey: "Workbench", groupKey: "Workbench", element: <WorkbenchPage /> },
  { path: "/discover", labelKey: "Discover", groupKey: "Discover", element: <DiscoverPage /> },
  { path: "/research", labelKey: "Research", groupKey: "Discover", element: <ResearchPage /> },
  { path: "/portfolio", labelKey: "Portfolio", groupKey: "Portfolio", element: <PortfolioPage /> },
  { path: "/live-sim", labelKey: "Quant simulation", groupKey: "Portfolio", element: <LiveSimPage /> },
  { path: "/his-replay", labelKey: "Historical replay", groupKey: "Portfolio", element: <HisReplayPage /> },
  { path: "/real-monitor", labelKey: "Real-time monitor", groupKey: "Portfolio", element: <RealMonitorPage />, hidden: true },
  { path: "/strategy-config", labelKey: "Strategy configuration", groupKey: "Settings", element: <StrategyConfigPage /> },
  { path: "/settings", labelKey: "Settings", groupKey: "Settings", element: <SettingsPage /> },
];

export const APP_ROUTE_LABELS = Object.fromEntries(
  APP_ROUTE_ITEMS.map((item) => [item.path, item.labelKey]),
) as Record<string, string>;
