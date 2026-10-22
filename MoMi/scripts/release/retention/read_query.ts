export function readRetentionQuery<T>(source: string): T {
  const value: unknown = JSON.parse(source)
  const rows = Array.isArray(value) ? value
    : value && typeof value === "object" && "rows" in value ? value.rows : null
  if (!Array.isArray(rows) || rows.length !== 1 || !rows[0] || typeof rows[0] !== "object") {
    throw new Error("Expected one retention evidence row")
  }
  return rows[0] as T
}
