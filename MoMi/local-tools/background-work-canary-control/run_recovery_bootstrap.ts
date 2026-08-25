import { buildGuardBootstrapInput } from "./build_guard_bootstrap_input.ts"
import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { generateGuardBootstrapSql } from "./generate_guard_bootstrap_sql.ts"
import { parseGuardBootstrapOutput } from "./parse_guard_bootstrap_output.ts"
import type { RecoveryState } from "./recovery_types.ts"

export async function runRecoveryBootstrap(state: RecoveryState, startCronRunId: number): Promise<void> {
  const input = buildGuardBootstrapInput(state.runtime, state.runId,
    state.generationSha256, startCronRunId)
  const result = await executeProviderQuery({ repositoryRoot: state.repositoryRoot,
    provider: state.runtime.provider, signal: state.signal,
    sql: createInternalProviderSql("guard_bootstrap", generateGuardBootstrapSql(input)),
    parser: (output) => parseGuardBootstrapOutput(output, { runId: state.runId,
      generationSha256: state.generationSha256, startCronRunId }) },
  { temporaryRoot: "/tmp" })
  if (result.status === "failure") throw new Error(`Recovery bootstrap ${result.reason}`)
  state.guard = result.value
  state.guardStartCronRunId = startCronRunId
}
