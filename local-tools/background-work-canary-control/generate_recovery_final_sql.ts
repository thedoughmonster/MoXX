import { generateRecoveryBoundaryConfigSql } from "./generate_recovery_boundary_config_sql.ts"
import { loadRecoverySnapshotSql } from "./load_recovery_snapshot_sql.ts"
import { RECOVERY_FINAL_MARKER } from "./recovery_constants.ts"
import type { RecoverySnapshot } from "./recovery_types.ts"
import { SQL_SCHEMA_VERSION } from "./sql_artifact_constants.ts"

export function generateRecoveryFinalSql(baseline: RecoverySnapshot): string {
  const snapshot = loadRecoverySnapshotSql().trimEnd().slice(0, -1).replace(/^/gm, "  ")
  return ["begin;", "set local statement_timeout = '12s';",
    generateRecoveryBoundaryConfigSql(baseline),
    "with recovery_snapshot as (", snapshot, ")",
    `select '${RECOVERY_FINAL_MARKER}'::text marker,`,
    `  ${SQL_SCHEMA_VERSION}::integer schema_version, sample`,
    "from recovery_snapshot;", "commit;", ""].join("\n")
}
