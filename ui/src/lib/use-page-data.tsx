import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiClient } from "./api-client";
import { apiClient } from "./api-client";
import type { PageKey, PageSnapshotMap } from "./page-models";

export type PageResourceState<T> = {
  status: "loading" | "ready" | "error";
  data: T | null;
  error: string | null;
  refresh: () => Promise<void>;
  runAction: (action: string, payload?: unknown) => Promise<T | null>;
};

const toMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

type PageQueryValue = string | number | boolean | null | undefined;

export function usePageData<K extends PageKey>(
  page: K,
  client: ApiClient = apiClient,
  query?: Record<string, PageQueryValue>,
): PageResourceState<PageSnapshotMap[K]> {
  const [data, setData] = useState<PageSnapshotMap[K] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus((current) => (current === "ready" ? "loading" : current));
    try {
      const snapshot: PageSnapshotMap[K] = (await client.getPageSnapshot(page, query)) as PageSnapshotMap[K];
      setData(snapshot);
      setStatus("ready");
      setError(null);
    } catch (err) {
      setError(toMessage(err));
      setStatus("error");
    }
  }, [client, page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = useCallback(
    async (action: string, payload?: unknown) => {
      try {
        const snapshot: PageSnapshotMap[K] = (await client.runPageAction(page, action, payload)) as PageSnapshotMap[K];
        setData(snapshot);
        setStatus("ready");
        setError(null);
        return snapshot;
      } catch (err) {
        setError(toMessage(err));
        setStatus("error");
        return null;
      }
    },
    [client, page],
  );

  return useMemo(
    () => ({
      status,
      data,
      error,
      refresh: load,
      runAction,
    }),
    [data, error, load, runAction, status],
  );
}
