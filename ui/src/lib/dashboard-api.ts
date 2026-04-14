import { fetchJson, postJson } from "./api";
import {
  normalizeDiscoveryOverview,
  normalizeResearchOverview,
  normalizeWorkbenchOverview,
} from "./summary-normalizers";
import type {
  DiscoveryOverview,
  ResearchOverview,
  WatchlistMutationInput,
  WatchlistMutationResponse,
  WorkbenchOverview,
} from "./contracts";

export function fetchWorkbenchOverview(symbol?: string) {
  const query = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
  return fetchJson<unknown>(`/workbench/overview${query}`).then(normalizeWorkbenchOverview);
}

export function fetchDiscoveryOverview(strategy?: string) {
  const query = strategy ? `?strategy=${encodeURIComponent(strategy)}` : "";
  return fetchJson<unknown>(`/discovery/hub${query}`).then(normalizeDiscoveryOverview);
}

export function fetchResearchOverview(module?: string) {
  const query = module ? `?module=${encodeURIComponent(module)}` : "";
  return fetchJson<unknown>(`/research/hub${query}`).then(normalizeResearchOverview);
}

export function addWatchlistEntry(input: WatchlistMutationInput) {
  return postJson<WatchlistMutationResponse>("/watchlist", input);
}

export type { DiscoveryOverview, ResearchOverview, WorkbenchOverview };
