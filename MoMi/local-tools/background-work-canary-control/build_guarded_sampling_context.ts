import type { SamplingExecutionState } from "./sampling_execution_state.ts"
import type { GuardedSamplingContext } from "./sampling_phase_types.ts"

export function buildGuardedSamplingContext(
  state: SamplingExecutionState,
): GuardedSamplingContext {
  if (!state.runId || !state.receipt || !state.guard ||
    !state.currentGenerationSha256 || !state.workBaseline ||
    !state.resourceBaseline) {
    throw new Error("Guarded sampling context is incomplete")
  }
  return {
    runtime: state.runtime, repositoryRoot: state.repositoryRoot,
    runId: state.runId, receipt: state.receipt,
    guard: state.guard, currentGenerationSha256: state.currentGenerationSha256,
    workBaseline: state.workBaseline, resourceBaseline: state.resourceBaseline,
    startBoundaryUtcMs: state.startBoundaryUtcMs ?? null,
    samplesCompleted: state.samplesCompleted,
    resourceSamplesCompleted: state.resourceSamplesCompleted,
    lastObservedAtUtcMs: state.lastObservedAtUtcMs,
  }
}
