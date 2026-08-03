import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { generateRecoveryPreflightSql } from "./generate_recovery_preflight_sql.ts"
import { parseRecoveryPreflightOutput } from "./parse_recovery_preflight_output.ts"
import type { RecoverySnapshot, RecoveryState } from "./recovery_types.ts"

export async function runRecoveryPreflight(state: RecoveryState): Promise<RecoverySnapshot> {
  const result = await executeProviderQuery({ repositoryRoot: state.repositoryRoot,
    provider: state.runtime.provider, signal: state.signal,
    sql: createInternalProviderSql("recovery_preflight", generateRecoveryPreflightSql()),
    parser: parseRecoveryPreflightOutput }, { temporaryRoot: "/tmp" })
  if (result.status === "failure") throw new Error(`Recovery preflight ${result.reason}`)
  return result.value
}
