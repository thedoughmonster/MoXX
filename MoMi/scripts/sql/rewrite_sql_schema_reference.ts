export function rewriteSqlSchemaReference(
  source: string,
  before: string,
  after: string,
): string {
  const escaped = before.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return source.replace(
    new RegExp(`(^|[^a-z0-9_])${escaped}\\.`, "gi"),
    (_match, prefix: string) => `${prefix}${after}.`,
  )
}
