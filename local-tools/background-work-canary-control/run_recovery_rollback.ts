import { buildRecoveryControlInput } from "./build_recovery_control_input.ts"
import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { generateRecoveryRollbackSql } from "./generate_recovery_rollback_sql.ts"
import { parseRollbackOutput } from "./parse_rollback_output.ts"
import { recoveryGenerationCandidates } from "./recovery_generation_candidates.ts"
import type { RecoveryState } from "./recovery_types.ts"

export async function runRecoveryRollback(state: RecoveryState): Promise<void> {
  if (!state.guard) throw new Error("Recovery guard is absent")
  if (state.runtime.lock.status() !== "held" || state.runtime.provider.status() === "lost") {
    throw new Error("Recovery rollback control is unavailable")
  }
  const input = buildRecoveryControlInput(state.runtime, state.guard.guardJobId)
  const result = await executeProviderQuery({ repositoryRoot: state.repositoryRoot,
    provider: state.runtime.provider,
    sql: createInternalProviderSql("rollback", generateRecoveryRollbackSql(
      input, state.runId, recoveryGenerationCandidates(state))),
    parser: (output) => parseRollbackOutput(output, input) }, { temporaryRoot: "/tmp" })
  if (result.status === "failure") throw new Error(`Recovery rollback ${result.reason}`)
}
