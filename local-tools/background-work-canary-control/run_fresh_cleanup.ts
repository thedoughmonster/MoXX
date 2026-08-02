import { buildRecoveryControlInput } from "./build_recovery_control_input.ts"
import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import type { DeadmanPhaseDependencies,
  DeadmanPhaseHandoff } from "./deadman_phase_types.ts"
import { generateCleanupSql } from "./generate_cleanup_sql.ts"
import { parseCleanupOutput } from "./parse_cleanup_output.ts"
import type { CleanupResult } from "./recovery_control_types.ts"
import type { ProviderQueryResult } from "./runtime_adapter_types.ts"

export async function runFreshCleanup(
  handoff: DeadmanPhaseHandoff,
  guardJobId: number,
  dependencies: Pick<DeadmanPhaseDependencies, "query">,
): Promise<ProviderQueryResult<CleanupResult>> {
  try {
    const input = buildRecoveryControlInput(handoff.runtime, guardJobId)
    return await dependencies.query({
      repositoryRoot: handoff.repositoryRoot,
      provider: handoff.runtime.provider,
      sql: createInternalProviderSql("cleanup", generateCleanupSql(input)),
      parser: (stdout) => parseCleanupOutput(stdout, input),
    })
  } catch {
    return { status: "failure", reason: "adapter_failure" }
  }
}
