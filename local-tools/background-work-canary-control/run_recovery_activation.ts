import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { generateRecoveryActivationSql } from "./generate_recovery_activation_sql.ts"
import { parseRecoveryActivationOutput } from "./parse_recovery_activation_output.ts"
import type { RecoveryActivation, RecoveryState } from "./recovery_types.ts"

export async function runRecoveryActivation(state: RecoveryState): Promise<RecoveryActivation> {
  if (!state.guard) throw new Error("Recovery guard is absent")
  const result = await executeProviderQuery({ repositoryRoot: state.repositoryRoot,
    provider: state.runtime.provider, signal: state.signal,
    sql: createInternalProviderSql("recovery_activation",
      generateRecoveryActivationSql(state.guard)),
    parser: (output) => parseRecoveryActivationOutput(output, state.guard!) },
  { temporaryRoot: "/tmp" })
  if (result.status === "failure") throw new Error(`Recovery activation ${result.reason}`)
  state.activation = result.value
  return result.value
}
