import { getMetricsConfiguration } from "./get_metrics_configuration.ts";

export function isConfigured(): boolean {
  return Boolean(
    Deno.env.get("SUPABASE_DB_URL") && getMetricsConfiguration(),
  );
}
