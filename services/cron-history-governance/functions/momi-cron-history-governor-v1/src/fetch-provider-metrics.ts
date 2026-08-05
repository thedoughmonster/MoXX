import type { MetricDocument } from "./types.ts";

const maximumMetricsBytes = 2_000_000;

export async function fetchMetrics(): Promise<MetricDocument> {
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("MOMI_CRON_HISTORY_METRICS_SECRET_KEY");
  if (!projectUrl || !secret) throw new Error("metrics_configuration_missing");
  const url = new URL("/customer/v1/privileged/metrics", projectUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
    throw new Error("metrics_origin_refused");
  }
  const response = await fetch(url, {
    headers: {
      Accept: "text/plain",
      Authorization: `Basic ${btoa(`username:${secret}`)}`,
    },
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error(`metrics_http_${response.status}`);
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > maximumMetricsBytes) {
    throw new Error("metrics_too_large");
  }
  const text = await response.text();
  if (text.length > maximumMetricsBytes) throw new Error("metrics_too_large");
  const headerDate = response.headers.get("date");
  const observed = headerDate ? new Date(headerDate) : new Date();
  return {
    text,
    observedAt: Number.isNaN(observed.getTime())
      ? new Date().toISOString()
      : observed.toISOString(),
  };
}
