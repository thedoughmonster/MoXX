import { buildGuardBootstrapInput } from "./build_guard_bootstrap_input.ts"
import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { generateGuardBootstrapSql } from "./generate_guard_bootstrap_sql.ts"
import { parseGuardBootstrapOutput } from "./parse_guard_bootstrap_output.ts"
import type { SamplingExecutionState } from "./sampling_execution_state.ts"
import type { SamplingPhaseDependencies } from "./sampling_phase_dependencies.ts"
import { SamplingPhaseError } from "./sampling_phase_error.ts"
import type { GuardBootstrapStageResult } from "./sampling_stage_types.ts"
import { assertSamplingLockHeld } from "./assert_sampling_lock_held.ts"

export async function runGuardBootstrap(
  state: SamplingExecutionState,
  dependencies: SamplingPhaseDependencies,
): Promise<GuardBootstrapStageResult> {
  if (!state.runId || !state.currentGenerationSha256 || !state.receipt) {
    throw new SamplingPhaseError("bootstrap", "unexpected_failure")
  }
  assertSamplingLockHeld(state, "bootstrap")
  const input = buildGuardBootstrapInput(
    state.runtime, state.runId, state.currentGenerationSha256,
    state.resourceBaseline?.maxCronRunId ?? -1,
  )
  const sql = createInternalProviderSql(
    "guard_bootstrap", generateGuardBootstrapSql(input),
  )
  state.guardMayExist = true
  let result
  try {
    result = await dependencies.query({
      repositoryRoot: state.repositoryRoot,
      provider: state.runtime.provider,
      signal: state.signal,
      sql,
      parser: (stdout) => parseGuardBootstrapOutput(stdout, {
        runId: state.runId,
        generationSha256: state.currentGenerationSha256,
        startCronRunId: state.resourceBaseline!.maxCronRunId,
      }),
    })
  } finally {
    state.bootstrapTerminalUtcMs = dependencies.clock.nowUtcMs()
  }
  if (result.status === "failure") {
    assertSamplingLockHeld(state, "bootstrap")
    throw new SamplingPhaseError("bootstrap", result.reason)
  }
  assertSamplingLockHeld(state, "bootstrap")
  state.guard = result.value
  const observedAtUtcMs = Date.parse(result.value.expiryUtc) - 30_000
  try {
    await dependencies.appendReceipt(state.receipt, {
      event_type: "guard_heartbeat",
      timestamp_utc: new Date(observedAtUtcMs).toISOString(),
      metrics: {
        status: "active",
        guard: {
          active: true, job_id: result.value.guardJobId,
          job_name: result.value.guardName, schedule: result.value.guardSchedule,
          generation_sha256: result.value.generationSha256,
          command_md5: result.value.commandMd5,
        },
      },
    })
    assertSamplingLockHeld(state, "receipt")
  } catch {
    assertSamplingLockHeld(state, "receipt")
    throw new SamplingPhaseError("receipt", "receipt_failure")
  }
  return { guard: result.value, generationSha256: result.value.generationSha256 }
}
