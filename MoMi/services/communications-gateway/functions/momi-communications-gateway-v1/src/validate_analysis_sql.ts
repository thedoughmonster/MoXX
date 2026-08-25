import { parse } from "pgsql-ast-parser"

const functions = new Set([
  "avg", "coalesce", "count", "date_trunc", "greatest", "least", "lower",
  "max", "min", "nullif", "round", "sum", "upper",
])

export function validateAnalysisSql(
  value: unknown,
  allowedRelations: Set<string>,
): { query: string } | {
  error: "analysis_query_invalid" | "analysis_query_not_allowed"
} {
  if (typeof value !== "string" || value.length < 1 || value.length > 6000) {
    return { error: "analysis_query_invalid" }
  }
  let normalized = value.trim()
  if (normalized.endsWith(";")) normalized = normalized.slice(0, -1).trimEnd()
  if (!normalized) return { error: "analysis_query_invalid" }
  if (/;|--|\/\*/u.test(normalized) || /^\s*with\s+recursive\b/iu.test(normalized)) {
    return { error: "analysis_query_not_allowed" }
  }
  let statements: unknown[]
  try { statements = parse(normalized) } catch {
    return { error: "analysis_query_invalid" }
  }
  if (statements.length !== 1) return { error: "analysis_query_not_allowed" }
  const statement = statements[0]
  if (!statement || typeof statement !== "object") {
    return { error: "analysis_query_invalid" }
  }
  const root = statement as Record<string, unknown>
  const commonTables = new Set<string>()
  if (root.type === "with") {
    if (root.recursive === true || !Array.isArray(root.bind) ||
      !root.in || typeof root.in !== "object" ||
      (root.in as { type?: unknown }).type !== "select") {
      return { error: "analysis_query_not_allowed" }
    }
    for (const item of root.bind) {
      if (!item || typeof item !== "object") {
        return { error: "analysis_query_not_allowed" }
      }
      const binding = item as Record<string, unknown>
      const alias = binding.alias as { name?: unknown } | undefined
      if (!alias || typeof alias.name !== "string" ||
        commonTables.has(alias.name.toLowerCase()) || !binding.statement ||
        typeof binding.statement !== "object" ||
        (binding.statement as { type?: unknown }).type !== "select") {
        return { error: "analysis_query_not_allowed" }
      }
      commonTables.add(alias.name.toLowerCase())
    }
  } else if (root.type !== "select") {
    return { error: "analysis_query_not_allowed" }
  }
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
      node.schema !== "momi_analysis" && node.schema !== "pg_catalog") {
      return { error: "analysis_query_not_allowed" }
    }
    if (node.type === "table") {
      const name = node.name as { schema?: unknown; name?: unknown } | undefined
      if (!name || typeof name.name !== "string") {
        return { error: "analysis_query_not_allowed" }
      }
      const relation = name.name.toLowerCase()
      if (!(name.schema === undefined && commonTables.has(relation))) {
        if (name.schema !== undefined && name.schema !== "momi_analysis" ||
          !allowedRelations.has(relation)) {
          return { error: "analysis_query_not_allowed" }
        }
        relationCount += 1
      }
    }
    if (node.type === "call") {
      const called = node.function as { schema?: unknown; name?: unknown } | undefined
      if (!called || typeof called.name !== "string" ||
        called.schema !== undefined && called.schema !== "pg_catalog" ||
        !functions.has(called.name.toLowerCase())) {
        return { error: "analysis_query_not_allowed" }
      }
    }
    for (const nested of Object.values(node)) stack.push(nested)
  }
  return relationCount > 0
    ? { query: normalized }
    : { error: "analysis_query_not_allowed" }
}
