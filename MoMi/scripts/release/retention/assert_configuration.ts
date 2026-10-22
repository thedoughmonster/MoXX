export function assertRetentionConfiguration(source: string): void {
  const rows: unknown = JSON.parse(source)
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row.name !== "string") ||
      !rows.some((row) => row.name === "MOMI_CRON_HISTORY_METRICS_SECRET_KEY")) {
    throw new Error("Governor metrics configuration is absent; stop before SQL")
  }
}
