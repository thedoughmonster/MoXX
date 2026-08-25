import { executeSamplingBoundary } from "./execute_sampling_boundary.ts"
import { planDryRunBoundaries } from "./plan_dry_run_boundaries.ts"
import type { SamplingExecutionState } from "./sampling_execution_state.ts"
import type { SamplingPhaseDependencies } from "./sampling_phase_dependencies.ts"
import { SamplingPhaseError } from "./sampling_phase_error.ts"
import type { SamplingBoundaryRunResult } from "./sampling_stage_types.ts"
import { assertSamplingLockHeld } from "./assert_sampling_lock_held.ts"

export async function runSamplingBoundaries(
  state: SamplingExecutionState,
  dependencies: SamplingPhaseDependencies,
): Promise<SamplingBoundaryRunResult> {
  if (!state.currentGenerationSha256) {
    throw new SamplingPhaseError("sampling", "unexpected_failure")
  }
  const intervalMs = 15_000
  const now = dependencies.clock.nowUtcMs()
  const startUtcMs = Math.ceil(now / intervalMs) * intervalMs
  state.startBoundaryUtcMs = startUtcMs
  const boundaries = planDryRunBoundaries(startUtcMs)
  const controller = new AbortController()
  let failure: SamplingPhaseError | undefined
  let active: Promise<void> | undefined
  const scheduled = dependencies.schedule(boundaries, {
    clock: dependencies.clock,
    timer: dependencies.timer,
    signal: state.signal,
    onStop: () => controller.abort(),
    launch: (boundary, lifecycle) => {
      active = executeSamplingBoundary(
        state, boundary, lifecycle, dependencies, controller.signal,
      ).then((record) => {
        if (record.parsed.stopReasons.length > 0) {
          failure = new SamplingPhaseError("sampling", "threshold_stop")
        }
      }).catch((error: unknown) => {
        failure = error instanceof SamplingPhaseError
          ? error : new SamplingPhaseError("sampling", "unexpected_failure")
        lifecycle.fail()
      })
    },
  })
  const schedulerResult = await scheduled
  await active
  assertSamplingLockHeld(state, "sampling")
  if (schedulerResult.status === "completed" && state.samplesCompleted === 21 &&
    state.resourceSamplesCompleted === 6 && state.lastObservedAtUtcMs !== null) {
    return {
      status: "completed", currentGenerationSha256: state.currentGenerationSha256,
      samplesCompleted: 21, resourceSamplesCompleted: 6,
      lastObservedAtUtcMs: state.lastObservedAtUtcMs,
    }
  }
  const reason = failure?.reason ?? (schedulerResult.status === "stopped"
    ? schedulerResult.reason : "unexpected_failure")
  return {
    status: "failed", stage: failure?.stage ?? "sampling", reason,
    schemaDiagnostic: failure?.schemaDiagnostic,
    childExitCode: failure?.childExitCode,
    providerCode: failure?.providerCode,
    stopReasons: state.stopReasons,
    currentGenerationSha256: state.currentGenerationSha256,
    samplesCompleted: state.samplesCompleted,
    resourceSamplesCompleted: state.resourceSamplesCompleted,
    lastObservedAtUtcMs: state.lastObservedAtUtcMs,
  }
}
