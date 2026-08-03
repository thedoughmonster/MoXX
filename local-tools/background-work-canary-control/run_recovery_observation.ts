import { buildCombinedHeartbeatInput } from "./build_combined_heartbeat_input.ts"
import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { generateRecoveryObservationSql } from "./generate_recovery_observation_sql.ts"
import { parseRecoveryObservationOutput } from "./parse_recovery_observation_output.ts"
import { RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES } from "./recovery_constants.ts"
import type { RecoveryObservation, RecoveryState } from "./recovery_types.ts"

export async function runRecoveryObservation(
  state: RecoveryState, nextGenerationSha256: string, includeResource: boolean,
): Promise<RecoveryObservation> {
  if (!state.guard || !state.activation || state.guardStartCronRunId === undefined) {
    throw new Error("Recovery activation is absent")
  }
  const input = buildCombinedHeartbeatInput(state.runtime, state.runId,
    state.guard.guardJobId, state.generationSha256, nextGenerationSha256,
    state.guardStartCronRunId, false)
  const { includeResource: _includeResource, ...heartbeat } = input
  state.attemptedGenerationSha256 = nextGenerationSha256
  const result = await executeProviderQuery({ repositoryRoot: state.repositoryRoot,
    provider: state.runtime.provider, signal: state.signal,
    sql: createInternalProviderSql("recovery_observation",
      generateRecoveryObservationSql(heartbeat, state.activation, includeResource,
        state.lastCohortProof)),
    outputLimitBytes: RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES,
    parser: (output) => parseRecoveryObservationOutput(output,
      state.generationSha256, nextGenerationSha256, state.guard!.guardJobId) },
  { temporaryRoot: "/tmp" })
  if (result.status === "failure") throw new Error(`Recovery observation ${result.reason}`)
  state.generationSha256 = nextGenerationSha256
  state.attemptedGenerationSha256 = undefined
  return result.value
}
