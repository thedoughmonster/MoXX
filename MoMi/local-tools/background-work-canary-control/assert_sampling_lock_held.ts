import type { SamplingExecutionState } from "./sampling_execution_state.ts"
import { SamplingPhaseError } from "./sampling_phase_error.ts"
import type { SamplingFailureStage } from "./sampling_phase_types.ts"

export function assertSamplingLockHeld(
  state: SamplingExecutionState,
  stage: SamplingFailureStage,
): void {
  if (state.runtime.lock.status() !== "held" || state.runtime.lock.lossSignal.aborted) {
    state.lockLossObserved = true
    throw new SamplingPhaseError(stage, "lifecycle_lock_lost")
  }
}
