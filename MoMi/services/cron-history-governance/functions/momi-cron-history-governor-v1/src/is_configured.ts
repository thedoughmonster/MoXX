export function isConfigured(): boolean {
  return Boolean(
    Deno.env.get("SUPABASE_DB_URL") &&
      Deno.env.get("SUPABASE_URL") &&
      Deno.env.get("MOMI_CRON_HISTORY_METRICS_SECRET_KEY"),
  );
}
