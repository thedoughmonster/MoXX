import { buildRecoveryControlInput } from "./build_recovery_control_input.ts"
import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { generateRecoveryCleanupSql } from "./generate_recovery_cleanup_sql.ts"
import { parseCleanupOutput } from "./parse_cleanup_output.ts"
import { recoveryGenerationCandidates } from "./recovery_generation_candidates.ts"
import type { RecoveryState } from "./recovery_types.ts"

export async function runRecoveryCleanup(state: RecoveryState): Promise<void> {
  if (!state.guard) throw new Error("Recovery guard is absent")
  if ((state.runtime.lock.status() !== "held" && !state.deadmanReconciled) ||
    state.runtime.provider.status() === "lost") {
    throw new Error("Recovery cleanup control is unavailable")
  }
  const input = buildRecoveryControlInput(state.runtime, state.guard.guardJobId)
  const result = await executeProviderQuery({ repositoryRoot: state.repositoryRoot,
    provider: state.runtime.provider,
    sql: createInternalProviderSql("cleanup", generateRecoveryCleanupSql(
      input, state.runId, recoveryGenerationCandidates(state),
      state.deadmanReconciled === true)),
    parser: (output) => parseCleanupOutput(output, input) }, { temporaryRoot: "/tmp" })
  if (result.status === "failure") throw new Error(`Recovery cleanup ${result.reason}`)
}
