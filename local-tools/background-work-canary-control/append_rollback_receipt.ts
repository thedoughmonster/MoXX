import type { ReceiptEventType } from "./receipt_types.ts"
import type { SamplingExecutionState } from "./sampling_execution_state.ts"
import type { SamplingPhaseDependencies } from "./sampling_phase_dependencies.ts"

export async function appendRollbackReceipt(
  state: SamplingExecutionState,
  dependencies: SamplingPhaseDependencies,
  eventType: Extract<ReceiptEventType, "rollback_started" | "rollback_completed">,
): Promise<boolean> {
  if (!state.receipt || state.receipt.poisoned) return false
  try {
    await dependencies.appendReceipt(state.receipt, {
      event_type: eventType,
      timestamp_utc: new Date(dependencies.clock.nowUtcMs()).toISOString(),
      metrics: {
        status: eventType === "rollback_started" ? "started" : "completed",
        rollback_invoked: true,
      },
    })
    return true
  } catch {
    return false
  }
}
