export function rewriteSqlObjectReference(
  source: string,
  before: string,
  after: string,
): string {
  const escaped = before.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return source.replace(
    new RegExp(`(^|[^a-z0-9_])${escaped}([^a-z0-9_]|$)`, "gi"),
    (_match, prefix: string, suffix: string) => `${prefix}${after}${suffix}`,
  )
}
