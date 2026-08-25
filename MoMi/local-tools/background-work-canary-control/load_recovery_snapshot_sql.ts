import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export function loadRecoverySnapshotSql(): string {
  const path = fileURLToPath(new URL("./sql/recovery_snapshot.sql", import.meta.url))
  const sql = readFileSync(path, "utf8")
  if (!sql.startsWith("with\n") || !sql.endsWith(";\n") || sql.includes("\0") ||
    Buffer.byteLength(sql, "utf8") > 128 * 1024) {
    throw new Error("Recovery snapshot SQL framing is invalid")
  }
  return sql
}
