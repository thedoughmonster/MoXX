import { APPROVED_PROVIDER_SQL } from "./provider_sql_registry.ts"
import type {
  InternalProviderSql,
  InternalProviderSqlKind,
} from "./runtime_adapter_types.ts"
import { sha256Text } from "./sha256_text.ts"

export function createInternalProviderSql(
  kind: InternalProviderSqlKind,
  sql: string,
): InternalProviderSql {
  if (![
    "cleanup", "deadman_reconciliation", "fast_sample", "guard_bootstrap",
    "guard_heartbeat_fast",
    "guard_heartbeat_resource", "recovery_activation", "recovery_final",
    "recovery_observation", "recovery_preflight", "resource_sample", "rollback",
  ].includes(kind) || typeof sql !== "string" || sql.length < 2 ||
    Buffer.byteLength(sql, "utf8") > 128 * 1024 || !sql.endsWith("\n") ||
    sql.includes("\0")) {
    throw new Error("Internal provider SQL is invalid")
  }
  const value = Object.freeze({ kind, sql, sha256: sha256Text(sql) })
  APPROVED_PROVIDER_SQL.add(value)
  return value
}
