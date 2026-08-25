import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { generateRecoveryFinalSql } from "./generate_recovery_final_sql.ts"
import { parseRecoveryFinalOutput } from "./parse_recovery_final_output.ts"
import { RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES } from "./recovery_constants.ts"
import type { RecoverySnapshot, RecoveryState } from "./recovery_types.ts"

export async function runRecoveryFinal(state: RecoveryState): Promise<RecoverySnapshot> {
  const baseline = state.activation?.frozen ?? state.preflight
  if (!baseline) throw new Error("Recovery final baseline is absent")
  const result = await executeProviderQuery({ repositoryRoot: state.repositoryRoot,
    provider: state.runtime.provider,
    sql: createInternalProviderSql("recovery_final",
      generateRecoveryFinalSql(state.lastCohortProof ?? baseline)),
    outputLimitBytes: RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES,
    parser: parseRecoveryFinalOutput }, { temporaryRoot: "/tmp" })
  if (result.status === "failure") throw new Error(`Recovery final readback ${result.reason}`)
  return result.value
}
