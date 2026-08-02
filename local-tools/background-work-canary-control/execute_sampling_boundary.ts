import { buildCombinedHeartbeatInput } from "./build_combined_heartbeat_input.ts"
import { buildSamplingBoundaryReceipt } from "./build_sampling_boundary_receipt.ts"
import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { createNextGeneration } from "./create_next_generation.ts"
import { generateCombinedHeartbeatSql } from "./generate_combined_heartbeat_sql.ts"
import { parseCombinedHeartbeatOutput } from "./parse_combined_heartbeat_output.ts"
import { MAX_LAUNCH_LATENESS_MS, PROVIDER_DEADLINE_MS } from "./schedule_constants.ts"
import type { SampleBoundary, SampleLifecycle } from "./schedule_types.ts"
import type { SamplingExecutionState } from "./sampling_execution_state.ts"
import type { SamplingPhaseDependencies } from "./sampling_phase_dependencies.ts"
import { SamplingPhaseError } from "./sampling_phase_error.ts"
import type { SamplingBoundaryRecord } from "./sampling_stage_types.ts"
import { assertSamplingLockHeld } from "./assert_sampling_lock_held.ts"

export async function executeSamplingBoundary(
  state: SamplingExecutionState,
  boundary: SampleBoundary,
  lifecycle: SampleLifecycle,
  dependencies: SamplingPhaseDependencies,
  signal: AbortSignal,
): Promise<SamplingBoundaryRecord> {
  if (!state.runId || !state.guard || !state.currentGenerationSha256 ||
    !state.workBaseline || !state.resourceBaseline || !state.receipt ||
    state.samplesCompleted !== boundary.index) {
    throw new SamplingPhaseError("sampling", "sample_stage_order_invalid")
  }
  assertSamplingLockHeld(state, "sampling")
  let nextGenerationSha256: string
  try {
    nextGenerationSha256 = createNextGeneration(
      dependencies.randomBytes, state.currentGenerationSha256,
    )
  } catch {
    throw new SamplingPhaseError("identity", "identity_failure")
  }
  const input = buildCombinedHeartbeatInput(
    state.runtime, state.runId, state.guard.guardJobId,
    state.currentGenerationSha256, nextGenerationSha256,
    state.resourceBaseline.maxCronRunId, boundary.resource,
  )
  const result = await dependencies.query({
    repositoryRoot: state.repositoryRoot,
    provider: state.runtime.provider,
    signal,
    sql: createInternalProviderSql(
      boundary.resource ? "guard_heartbeat_resource" : "guard_heartbeat_fast",
      generateCombinedHeartbeatSql(input),
    ),
    parser: (stdout) => {
      lifecycle.providerComplete()
      const parsed = parseCombinedHeartbeatOutput(stdout, {
        runId: state.runId, guardJobId: state.guard!.guardJobId,
        previousGenerationSha256: state.currentGenerationSha256,
        nextGenerationSha256, includeResource: boundary.resource,
        startCronRunId: state.resourceBaseline!.maxCronRunId,
        missedSamples: 0, overlappingSamples: 0,
        workBaseline: state.workBaseline, resourceBaseline: boundary.resource
          ? state.resourceBaseline : null,
      })
      lifecycle.parseComplete()
      return parsed
    },
  })
  if (result.status === "failure") {
    assertSamplingLockHeld(state, "sampling")
    throw new SamplingPhaseError("sampling", result.reason)
  }
  assertSamplingLockHeld(state, "sampling")
  state.currentGenerationSha256 = nextGenerationSha256
  const observed = result.value.heartbeat.observedAtUtcMs
  if (observed < boundary.scheduledAtUtcMs - MAX_LAUNCH_LATENESS_MS ||
    observed > boundary.scheduledAtUtcMs + PROVIDER_DEADLINE_MS ||
    (state.lastObservedAtUtcMs !== null && observed <= state.lastObservedAtUtcMs)) {
    throw new SamplingPhaseError("sampling", "preflight_rejected")
  }
  lifecycle.evaluateComplete()
  const durationMs = Math.max(0, dependencies.clock.nowUtcMs() - boundary.scheduledAtUtcMs)
  try {
    await dependencies.appendReceipt(state.receipt, buildSamplingBoundaryReceipt(
      boundary, result.value, state.resourceBaseline, durationMs,
    ))
    assertSamplingLockHeld(state, "receipt")
  } catch {
    assertSamplingLockHeld(state, "receipt")
    throw new SamplingPhaseError("receipt", "receipt_failure")
  }
  state.samplesCompleted += 1
  if (boundary.resource) state.resourceSamplesCompleted += 1
  state.lastObservedAtUtcMs = observed
  if (result.value.stopReasons.length > 0) {
    state.stopReasons = result.value.stopReasons
    lifecycle.stopAfterReceipt()
  } else {
    lifecycle.receiptComplete()
  }
  return { parsed: result.value, nextGenerationSha256 }
}
