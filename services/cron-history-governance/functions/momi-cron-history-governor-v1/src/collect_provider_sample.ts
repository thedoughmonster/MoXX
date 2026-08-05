import { fetchMetrics } from "./fetch-provider-metrics.ts";
import { reduceMetrics } from "./reduce_metrics.ts";
import type { ProviderMetricSample } from "./types.ts";

export async function collectProviderSample(): Promise<ProviderMetricSample> {
  const warningSetting =
    Deno.env.get("MOMI_CRON_HISTORY_PROVIDER_WARNING_METRICS") ?? "";
  const warningNames = warningSetting.split(",")
    .map((item) => item.trim()).filter(Boolean);
  const document = await fetchMetrics();
  return reduceMetrics(document.text, document.observedAt, warningNames);
}
