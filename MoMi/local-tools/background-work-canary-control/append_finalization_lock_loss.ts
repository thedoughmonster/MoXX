import type { CanaryProgramDependencies } from "./program_types.ts"
import type { ReceiptWriterState } from "./receipt_types.ts"

export async function appendFinalizationLockLoss(
  receipt: ReceiptWriterState,
  dependencies: Pick<CanaryProgramDependencies,
    "appendReceipt" | "nowUtcMs" | "verifyReceipt">,
): Promise<boolean> {
  if (receipt.poisoned) return false
  try {
    await dependencies.appendReceipt(receipt, {
      event_type: "failure",
      timestamp_utc: new Date(dependencies.nowUtcMs()).toISOString(),
      metrics: {
        status: "manual_reconciliation_required",
        error_class: "finalization_lock_lost",
        rollback_invoked: false,
      },
    })
    await dependencies.verifyReceipt(receipt.path)
    return true
  } catch {
    receipt.poisoned = true
    return false
  }
}
