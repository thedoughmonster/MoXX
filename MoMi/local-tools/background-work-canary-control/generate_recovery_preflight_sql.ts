import { RECOVERY_PREFLIGHT_MARKER } from "./recovery_constants.ts"
import { loadRecoverySnapshotSql } from "./load_recovery_snapshot_sql.ts"
import { SQL_SCHEMA_VERSION } from "./sql_artifact_constants.ts"

export function generateRecoveryPreflightSql(): string {
  const snapshot = loadRecoverySnapshotSql().trimEnd().slice(0, -1).replace(/^/gm, "  ")
  return [
    "with recovery_snapshot as (", snapshot, ")",
    `select '${RECOVERY_PREFLIGHT_MARKER}'::text as marker,`,
    `  ${SQL_SCHEMA_VERSION}::integer as schema_version, sample`,
    "from recovery_snapshot;", "",
  ].join("\n")
}
