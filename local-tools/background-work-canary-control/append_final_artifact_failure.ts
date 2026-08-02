import type { CanaryProgramDependencies } from "./program_types.ts"
import type { ReceiptWriterState } from "./receipt_types.ts"

export async function appendFinalArtifactFailure(
  receipt: ReceiptWriterState,
  dependencies: Pick<CanaryProgramDependencies,
    "appendReceipt" | "nowUtcMs" | "verifyReceipt">,
): Promise<void> {
  if (receipt.poisoned) return
  try {
    await dependencies.appendReceipt(receipt, {
      event_type: "failure",
      timestamp_utc: new Date(dependencies.nowUtcMs()).toISOString(),
      metrics: {
        status: "manual_reconciliation_required",
        error_class: "final_artifact_failed",
        rollback_invoked: false,
      },
    })
    await dependencies.verifyReceipt(receipt.path)
  } catch {
    receipt.poisoned = true
  }
}
