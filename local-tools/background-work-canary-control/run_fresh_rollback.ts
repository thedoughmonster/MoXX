import { buildRecoveryControlInput } from "./build_recovery_control_input.ts"
import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { generateRollbackSql } from "./generate_rollback_sql.ts"
import { parseRollbackOutput } from "./parse_rollback_output.ts"
import type { RollbackResult } from "./recovery_control_types.ts"
import type { ProviderQueryResult } from "./runtime_adapter_types.ts"
import type { SamplingExecutionState } from "./sampling_execution_state.ts"
import type { SamplingPhaseDependencies } from "./sampling_phase_dependencies.ts"

export async function runFreshRollback(
  state: SamplingExecutionState,
  dependencies: SamplingPhaseDependencies,
): Promise<ProviderQueryResult<RollbackResult>> {
  if (!state.guard) return { status: "failure", reason: "adapter_failure" }
  try {
    const input = buildRecoveryControlInput(state.runtime, state.guard.guardJobId)
    return await dependencies.query({
      repositoryRoot: state.repositoryRoot,
      pnpmExecutable: state.runtime.executables.pnpmExecutable,
      sql: createInternalProviderSql("rollback", generateRollbackSql(input)),
      parser: (stdout) => parseRollbackOutput(stdout, input),
    })
  } catch {
    return { status: "failure", reason: "adapter_failure" }
  }
}
