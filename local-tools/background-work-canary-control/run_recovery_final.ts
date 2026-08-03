import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { generateRecoveryFinalSql } from "./generate_recovery_final_sql.ts"
import { parseRecoveryFinalOutput } from "./parse_recovery_final_output.ts"
import type { RecoverySnapshot, RecoveryState } from "./recovery_types.ts"

export async function runRecoveryFinal(state: RecoveryState): Promise<RecoverySnapshot> {
  const result = await executeProviderQuery({ repositoryRoot: state.repositoryRoot,
    provider: state.runtime.provider,
    sql: createInternalProviderSql("recovery_final", generateRecoveryFinalSql()),
    parser: parseRecoveryFinalOutput }, { temporaryRoot: "/tmp" })
  if (result.status === "failure") throw new Error(`Recovery final readback ${result.reason}`)
  return result.value
}
