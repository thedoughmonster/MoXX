import { fetchMetrics } from "./fetch-provider-metrics.ts";
import { reduceMetrics } from "./reduce_metrics.ts";
import type { ProviderMetricSample } from "./types.ts";

export async function collectProviderSample(): Promise<ProviderMetricSample> {
  const document = await fetchMetrics();
  return reduceMetrics(document.text, document.observedAt);
}
