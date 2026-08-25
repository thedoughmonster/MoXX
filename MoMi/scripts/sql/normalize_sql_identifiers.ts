import { stripSqlComments } from "./strip_sql_comments.ts"

export function normalizeSqlIdentifiers(source: string): string {
  const normalized = stripSqlComments(source)
  return normalized.replace(/"([a-z_][a-z0-9_]*)"/gi, "$1")
    .replace(new RegExp(
      `([a-z_][a-z0-9_]*)\\s*\\.\\s*([a-z_][a-z0-9_]*)`,
      "gi",
    ), "$1.$2")
    .replace(new RegExp(
      `([a-z_][a-z0-9_]*(?:\\.[a-z_][a-z0-9_]*)?)\\s*\\(`,
      "gi",
    ), "$1(")
}
