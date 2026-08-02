import { EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE } from "./sample_constants.ts"
import type { SamplingExecutionState } from "./sampling_execution_state.ts"
import type { SamplingBootstrapAmbiguous,
  SamplingFailureReason } from "./sampling_phase_types.ts"

export function buildAmbiguousBootstrapContext(
  state: SamplingExecutionState,
  reason: SamplingFailureReason,
): SamplingBootstrapAmbiguous {
  if (!state.guardMayExist || state.guard || !state.runId || !state.receipt ||
    !state.currentGenerationSha256 || !state.workBaseline || !state.resourceBaseline ||
    state.bootstrapTerminalUtcMs === undefined) {
    throw new Error("Ambiguous bootstrap context is incomplete")
  }
  return {
    status: "bootstrap_ambiguous_deadman_fallback_pending",
    stage: "bootstrap", reason, runtime: state.runtime,
    repositoryRoot: state.repositoryRoot, runId: state.runId,
    receipt: state.receipt,
    attemptedGenerationSha256: state.currentGenerationSha256,
    bootstrapTerminalUtcMs: state.bootstrapTerminalUtcMs,
    workBaseline: state.workBaseline, resourceBaseline: state.resourceBaseline,
    guardName: EXPECTED_GUARD_NAME, guardSchedule: EXPECTED_GUARD_SCHEDULE,
    lockReleased: false,
  }
}
