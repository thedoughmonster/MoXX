import type { MetricDocument } from "./types.ts";
import { metricsAuthorization } from "./metrics-authorization.ts";
import { getMetricsConfiguration } from "./get_metrics_configuration.ts";

const maximumMetricsBytes = 2_000_000;

export async function fetchMetrics(): Promise<MetricDocument> {
  const configuration = getMetricsConfiguration();
  if (!configuration) throw new Error("metrics_configuration_missing");
  const response = await fetch(configuration.url, {
    headers: {
      Accept: "text/plain",
      Authorization: metricsAuthorization(configuration.secret),
    },
    redirect: "error",
    signal: AbortSignal.timeout(2000),
  }).catch(() => {
    throw new Error("metrics_request_failed");
  });
  if (!response.ok) throw new Error(`metrics_http_${response.status}`);
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > maximumMetricsBytes) {
    throw new Error("metrics_too_large");
  }
  const text = await response.text().catch(() => {
    throw new Error("metrics_response_failed");
  });
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
