import type { SamplingExecutionState } from "./sampling_execution_state.ts"
import type { SamplingPhaseDependencies } from "./sampling_phase_dependencies.ts"
import type { SamplingFailureReason } from "./sampling_phase_types.ts"

export async function appendSamplingFailureReceipt(
  state: SamplingExecutionState,
  dependencies: SamplingPhaseDependencies,
  reason: SamplingFailureReason | "provider_deadman_fallback_pending",
  rollbackInvoked: boolean,
): Promise<boolean> {
  if (!state.receipt || state.receipt.poisoned) return false
  try {
    await dependencies.appendReceipt(state.receipt, {
      event_type: "failure",
      timestamp_utc: new Date(dependencies.clock.nowUtcMs()).toISOString(),
      metrics: {
        status: "failed", error_class: reason,
        rollback_invoked: rollbackInvoked,
      },
    })
    return true
  } catch {
    return false
  }
}
