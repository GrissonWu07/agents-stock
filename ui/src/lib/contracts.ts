export type SummaryMetric = {
  label: string;
  value: string;
  hint?: string;
  delta?: string;
};

export type WatchlistRow = {
  code: string;
  name: string;
  price: string;
  source: string;
  status: string;
  quantStatus: string;
};

export type WorkbenchAnalysis = {
  symbol: string;
  name?: string;
  mode: string;
  period: string;
  analysts: string[];
  headline: string;
  verdict: string;
  highlights: string[];
  evidence: Array<{
    label: string;
    value: string;
    note?: string;
  }>;
  action?: string;
};

export type WorkbenchOverview = {
  updatedAt: string;
  metrics: SummaryMetric[];
  watchlist: {
    rows: WatchlistRow[];
    emptyMessage: string;
  };
  analysis: WorkbenchAnalysis;
  nextSteps: Array<{
    label: string;
    hint: string;
    to: string;
    tone?: "primary" | "neutral" | "danger";
  }>;
};

export type DiscoveryStrategy = {
  key: string;
  name: string;
  note: string;
  status: string;
  candidateCount?: number;
};

export type DiscoveryCandidate = {
  code: string;
  name: string;
  industry: string;
  source: string;
  latestPrice: string;
  reason: string;
};

export type DiscoveryOverview = {
  updatedAt: string;
  metrics: SummaryMetric[];
  strategies: DiscoveryStrategy[];
  candidateTable: {
    rows: DiscoveryCandidate[];
    summary: string;
    emptyMessage: string;
  };
  highlights: string[];
};

export type ResearchModule = {
  key: string;
  name: string;
  note: string;
  output: string;
};

export type ResearchStockOutput = {
  code: string;
  name: string;
  source: string;
  action: string;
  reason: string;
};

export type ResearchOverview = {
  updatedAt: string;
  metrics: SummaryMetric[];
  modules: ResearchModule[];
  marketJudgment: string[];
  stockOutputs: {
    rows: ResearchStockOutput[];
    emptyMessage: string;
  };
  highlights: string[];
};

export type WatchlistMutationResponse = {
  ok: boolean;
  message: string;
};

export type WatchlistMutationInput = {
  code: string;
  name?: string;
  source: string;
  price?: string;
  context?: string;
};
