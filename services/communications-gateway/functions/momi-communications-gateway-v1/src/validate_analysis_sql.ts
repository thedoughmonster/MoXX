import { parse } from "pgsql-ast-parser"

const functions = new Set([
  "avg", "coalesce", "count", "date_trunc", "greatest", "least", "lower",
  "max", "min", "nullif", "round", "sum", "upper",
])

export function validateAnalysisSql(
  value: unknown,
  allowedRelations: Set<string>,
): string | null {
  if (typeof value !== "string" || value.length < 1 || value.length > 6000 ||
    /;|--|\/\*/u.test(value)) return null
  let statements: unknown[]
  try { statements = parse(value) } catch { return null }
  if (statements.length !== 1) return null
  const statement = statements[0]
  if (!statement || typeof statement !== "object" ||
    (statement as { type?: unknown }).type !== "select") return null
  const stack: unknown[] = [statement]
  let relationCount = 0
  while (stack.length > 0) {
    const current = stack.pop()
    if (Array.isArray(current)) {
      stack.push(...current)
      continue
    }
    if (!current || typeof current !== "object") continue
    const node = current as Record<string, unknown>
    if (typeof node.schema === "string" &&
      node.schema !== "momi_analysis" && node.schema !== "pg_catalog") return null
    if (node.type === "table") {
      const name = node.name as { schema?: unknown; name?: unknown } | undefined
      if (!name || typeof name.name !== "string" ||
        name.schema !== undefined && name.schema !== "momi_analysis" ||
        !allowedRelations.has(name.name.toLowerCase())) return null
      relationCount += 1
    }
    if (node.type === "call") {
      const called = node.function as { schema?: unknown; name?: unknown } | undefined
      if (!called || typeof called.name !== "string" ||
        called.schema !== undefined && called.schema !== "pg_catalog" ||
        !functions.has(called.name.toLowerCase())) return null
    }
    for (const nested of Object.values(node)) stack.push(nested)
  }
  return relationCount > 0 ? value.trim() : null
}
