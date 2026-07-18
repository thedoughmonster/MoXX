import { createHash } from "node:crypto"

import { splitSqlStatements } from "./split_sql_statements.ts"

export function hashSqlObjectReferences(
  source: string,
  objectName: string,
): string {
  const escaped = objectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const reference = new RegExp(`(^|[^a-z0-9_])${escaped}([^a-z0-9_]|$)`, "i")
  const statements = splitSqlStatements(source)
    .map((statement) => statement.text.trim().replace(/\s+/g, " "))
    .filter((statement) => reference.test(statement))
  if (statements.length === 0) {
    throw new Error(`Cannot hash absent SQL object reference ${objectName}`)
  }
  return `sha256:${createHash("sha256").update(statements.join("\n"))
    .digest("hex")}`
}
