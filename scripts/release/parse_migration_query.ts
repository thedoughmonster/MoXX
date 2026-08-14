export function parseMigrationQuery(source: string): string[] {
  const result = JSON.parse(source) as unknown
  const rows = Array.isArray(result) ? result
    : result && typeof result === "object" && "rows" in result
    ? (result as { rows?: unknown }).rows
    : undefined
  if (!Array.isArray(rows)) throw new Error("Migration query returned no rows")
  return rows.map((row) => {
    const version = row && typeof row === "object" && "version" in row
      ? (row as { version?: unknown }).version
      : undefined
    if (typeof version !== "string" || !/^\d{14}$/.test(version)) {
      throw new Error("Migration query returned an invalid version")
    }
    return version
  })
}
