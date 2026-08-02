import type { DeadmanManualEvidence, DeadmanManualReason,
  DeadmanManualResult, DeadmanPhaseDependencies,
  DeadmanPhaseHandoff } from "./deadman_phase_types.ts"

export async function finalizeDeadmanManual(
  handoff: DeadmanPhaseHandoff,
  reason: DeadmanManualReason,
  evidence: Omit<DeadmanManualEvidence, "receiptPersisted" | "receiptVerified">,
  dependencies: Pick<DeadmanPhaseDependencies,
    "appendReceipt" | "clock" | "verifyReceipt">,
): Promise<DeadmanManualResult> {
  let receiptPersisted = false
  let receiptVerified = false
  if (!handoff.receipt.poisoned) {
    try {
      await dependencies.appendReceipt(handoff.receipt, {
        event_type: "failure",
        timestamp_utc: new Date(dependencies.clock.nowUtcMs()).toISOString(),
        metrics: {
          status: "manual_reconciliation_required",
          error_class: reason,
          rollback_invoked: false,
        },
      })
      receiptPersisted = true
      await dependencies.verifyReceipt(handoff.receipt.path)
      receiptVerified = true
    } catch {
      receiptVerified = false
    }
  }
  return {
    status: "manual_reconciliation_required", reason,
    runId: handoff.runId, runtime: handoff.runtime, receipt: handoff.receipt,
    evidence: { ...evidence, receiptPersisted, receiptVerified },
    lockReleased: false,
  }
}
