export function countSqlReferences(source: string, objectName: string): string {
  const escaped = objectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const matches = source.match(new RegExp(
    `(^|[^a-z0-9_])${escaped}([^a-z0-9_]|$)`,
    "gi",
  ))
  return String(matches?.length ?? 0)
}
