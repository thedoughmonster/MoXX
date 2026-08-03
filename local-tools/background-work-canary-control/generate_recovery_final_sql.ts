import { loadRecoverySnapshotSql } from "./load_recovery_snapshot_sql.ts"
import { RECOVERY_FINAL_MARKER } from "./recovery_constants.ts"
import { SQL_SCHEMA_VERSION } from "./sql_artifact_constants.ts"

export function generateRecoveryFinalSql(): string {
  const snapshot = loadRecoverySnapshotSql().trimEnd().slice(0, -1).replace(/^/gm, "  ")
  return ["with recovery_snapshot as (", snapshot, ")",
    `select '${RECOVERY_FINAL_MARKER}'::text marker,`,
    `  ${SQL_SCHEMA_VERSION}::integer schema_version, sample`,
    "from recovery_snapshot;", ""].join("\n")
}
