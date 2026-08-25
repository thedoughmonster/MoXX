export function parseMigrationQuery(source: string): string[] {
  const result = JSON.parse(source) as { rows?: Array<{ version?: unknown }> }
  if (!Array.isArray(result.rows)) throw new Error("Migration query returned no rows")
  return result.rows.map((row) => {
    if (typeof row.version !== "string" || !/^\d{14}$/.test(row.version)) {
      throw new Error("Migration query returned an invalid version")
    }
    return row.version
  })
}
