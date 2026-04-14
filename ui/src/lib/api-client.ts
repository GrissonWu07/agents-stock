import type { PageKey, PageSnapshotMap } from "./page-models";
import { mockPageSnapshot, mockRunPageAction } from "./mock-backend";

export type ApiMode = "live" | "hybrid" | "mock";

export type ApiClientOptions = {
  baseUrl?: string;
  mode?: ApiMode;
  fetchImpl?: typeof fetch;
};

export const PAGE_ENDPOINTS: Record<PageKey, string> = {
  workbench: "/ui/workbench",
  discover: "/ui/discover",
  research: "/ui/research",
  portfolio: "/ui/portfolio",
  "live-sim": "/ui/quant/live-sim",
  "his-replay": "/ui/quant/his-replay",
  "ai-monitor": "/ui/monitor/ai",
  "real-monitor": "/ui/monitor/real",
  history: "/ui/history",
  settings: "/ui/settings",
};

export const PAGE_ACTION_ENDPOINTS: Record<PageKey, Record<string, string>> = {
  workbench: {
    "add-watchlist": "/ui/workbench/actions/add-watchlist",
    "refresh-watchlist": "/ui/workbench/actions/refresh-watchlist",
    "batch-quant": "/ui/workbench/actions/batch-quant",
    analysis: "/ui/workbench/actions/analysis",
    "analysis-batch": "/ui/workbench/actions/analysis-batch",
    "clear-selection": "/ui/workbench/actions/clear-selection",
    "delete-watchlist": "/ui/workbench/actions/delete-watchlist",
  },
  discover: {
    "run-strategy": "/ui/discover/actions/run-strategy",
    "batch-watchlist": "/ui/discover/actions/batch-watchlist",
    "item-watchlist": "/ui/discover/actions/item-watchlist",
  },
  research: {
    "run-module": "/ui/research/actions/run-module",
    "batch-watchlist": "/ui/research/actions/batch-watchlist",
    "item-watchlist": "/ui/research/actions/item-watchlist",
  },
  portfolio: {
    analyze: "/ui/portfolio/actions/analyze",
    "refresh-portfolio": "/ui/portfolio/actions/refresh-portfolio",
    "schedule-save": "/ui/portfolio/actions/schedule-save",
    "schedule-start": "/ui/portfolio/actions/schedule-start",
    "schedule-stop": "/ui/portfolio/actions/schedule-stop",
  },
  "live-sim": {
    save: "/ui/quant/live-sim/actions/save",
    start: "/ui/quant/live-sim/actions/start",
    stop: "/ui/quant/live-sim/actions/stop",
    reset: "/ui/quant/live-sim/actions/reset",
    "analyze-candidate": "/ui/quant/live-sim/actions/analyze-candidate",
    "delete-candidate": "/ui/quant/live-sim/actions/delete-candidate",
    "bulk-quant": "/ui/quant/live-sim/actions/bulk-quant",
  },
  "his-replay": {
    start: "/ui/quant/his-replay/actions/start",
    continue: "/ui/quant/his-replay/actions/continue",
    cancel: "/ui/quant/his-replay/actions/cancel",
    delete: "/ui/quant/his-replay/actions/delete",
  },
  "ai-monitor": {
    start: "/ui/monitor/ai/actions/start",
    stop: "/ui/monitor/ai/actions/stop",
    analyze: "/ui/monitor/ai/actions/analyze",
    delete: "/ui/monitor/ai/actions/delete",
  },
  "real-monitor": {
    start: "/ui/monitor/real/actions/start",
    stop: "/ui/monitor/real/actions/stop",
    refresh: "/ui/monitor/real/actions/refresh",
    "update-rule": "/ui/monitor/real/actions/update-rule",
    "delete-rule": "/ui/monitor/real/actions/delete-rule",
  },
  history: {
    rerun: "/ui/history/actions/rerun",
  },
  settings: {
    save: "/ui/settings/actions/save",
  },
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE ?? "/api";
const DEFAULT_MODE = (import.meta.env.VITE_UI_API_MODE as ApiMode | undefined) ?? "live";

const safeJson = (value: unknown) => JSON.stringify(value ?? {});

const isNetworkFailure = (error: unknown) =>
  error instanceof TypeError || (error instanceof Error && /fetch|network|Failed to fetch/i.test(error.message));

const parseResponseJson = async <T,>(response: Response, path: string): Promise<T> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new ApiError("Empty response body", response.status, path);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(`Invalid JSON response from ${path}`, response.status, path);
  }
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const mode = options.mode ?? DEFAULT_MODE;
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);

  const requestLive = async <T,>(path: string, request: RequestOptions = {}): Promise<T> => {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: request.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
      },
      body: request.body === undefined ? undefined : safeJson(request.body),
      signal: request.signal,
    });

    if (!response.ok) {
      throw new ApiError(`Request failed: ${response.status}`, response.status, path);
    }

    return await parseResponseJson<T>(response, path);
  };

  const requestMock = async <T,>(page: PageKey, action?: string, payload?: unknown): Promise<T> =>
    (action ? mockRunPageAction(page, action, payload) : mockPageSnapshot(page)) as T;

  const requestPage = async <T,>(page: PageKey): Promise<T> => {
    try {
      if (mode === "mock") {
        return await requestMock<T>(page);
      }
      return await requestLive<T>(PAGE_ENDPOINTS[page]);
    } catch (error) {
      if (mode === "hybrid") {
        return await requestMock<T>(page);
      }
      throw error;
    }
  };

  const requestAction = async <T,>(page: PageKey, action: string, payload?: unknown): Promise<T> => {
    try {
      if (mode === "mock") {
        return await requestMock<T>(page, action, payload);
      }
      const endpoint = PAGE_ACTION_ENDPOINTS[page][action] ?? `${PAGE_ENDPOINTS[page]}/actions/${action}`;
      return await requestLive<T>(endpoint, {
        method: "POST",
        body: payload ?? {},
      });
    } catch (error) {
      if (mode === "hybrid") {
        return await requestMock<T>(page, action, payload);
      }
      throw error;
    }
  };

  return {
    baseUrl,
    mode,
    getPageSnapshot: requestPage,
    runPageAction: requestAction,
  };
}

export const apiClient = createApiClient();

export type ApiClient = ReturnType<typeof createApiClient>;

export type PageSnapshotFor<K extends PageKey> = PageSnapshotMap[K];
