export const functionKey = "momi.cron_history.governor.v1";

export interface TickInput {
  tick_id: string;
  capability_token: string;
}

export interface TickClaim {
  tick_status: string;
  phase: string;
}

export interface MetricPoint {
  name: string;
  labels: Record<string, string>;
  value: number;
}

export interface MetricDocument {
  text: string;
  observedAt: string;
}

export interface ProviderMetricSample {
  sourceObservedAt: string;
  cpuTotalSeconds: number | null;
  cpuIdleSeconds: number | null;
  ramPct: number | null;
  swapUsedBytes: number | null;
  ioBusySeconds: number | null;
  allocatedDiskPct: number | null;
  providerConnections: number | null;
  providerWarning: boolean | null;
  sourceComplete: boolean;
}

export interface GovernorDependencies {
  claim: (input: TickInput) => Promise<TickClaim | null>;
  collect: () => Promise<ProviderMetricSample>;
  record: (input: TickInput, sample: ProviderMetricSample) => Promise<unknown>;
  readReceipt: (input: TickInput) => Promise<unknown | null>;
}

export interface ProcessResult {
  status: number;
  body: Record<string, unknown>;
}
