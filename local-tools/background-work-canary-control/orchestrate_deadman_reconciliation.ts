import { appendCleanupReceipt } from "./append_cleanup_receipt.ts"
import { appendReconciliationReceipt } from "./append_reconciliation_receipt.ts"
import { appendSyntheticLossReceipt } from "./append_synthetic_loss_receipt.ts"
import type { DeadmanPhaseDependencies, DeadmanPhaseInput,
  DeadmanPhaseResult, DeadmanVerifiedStatus } from "./deadman_phase_types.ts"
import { deriveDeadmanDeadline } from "./derive_deadman_deadline.ts"
import { finalizeDeadmanManual } from "./finalize_deadman_manual.ts"
import { finalizeDeadmanSuccess } from "./finalize_deadman_success.ts"
import { runDeadmanReconciliation } from "./run_deadman_reconciliation.ts"
import { runFinalInactiveReadback } from "./run_final_inactive_readback.ts"
import { runFreshCleanup } from "./run_fresh_cleanup.ts"
import { waitForDeadmanDeadline } from "./wait_for_deadman_deadline.ts"

export async function orchestrateDeadmanReconciliation(
  input: DeadmanPhaseInput,
  dependencies: DeadmanPhaseDependencies,
): Promise<DeadmanPhaseResult> {
  const handoff = input.handoff
  const holderLost = () => handoff.runtime.lock.status() === "lost" ||
    handoff.runtime.lock.lossSignal.aborted
  let holderLossObserved = holderLost()
  const evidence = {
    cleanupAttempted: false,
    guardIdentityCount: null,
    guardJobId: null,
  }
  if (handoff.status === "sampling_complete_waiting_for_synthetic_loss" &&
      (handoff.samplesCompleted !== 21 || handoff.resourceSamplesCompleted !== 6 ||
        handoff.lastObservedAtUtcMs === null)) {
    return await finalizeDeadmanManual(
      handoff, "handoff_invalid", evidence, dependencies,
    )
  }
  let deadlineUtcMs: number
  try {
    deadlineUtcMs = deriveDeadmanDeadline(handoff)
  } catch {
    return await finalizeDeadmanManual(
      handoff, "handoff_invalid", evidence, dependencies,
    )
  }
  const stopReceiptPersisted = await appendSyntheticLossReceipt(handoff, dependencies)
  const wait = await waitForDeadmanDeadline(
    deadlineUtcMs, dependencies, input.signal, handoff.runtime.lock.lossSignal,
  )
  holderLossObserved ||= wait.holderLossObserved || holderLost()
  if (wait.status !== "deadline_reached") {
    return await finalizeDeadmanManual(
      handoff, "deadline_late_or_missed", evidence, dependencies,
    )
  }
  const reconciliation = await runDeadmanReconciliation(handoff, dependencies)
  holderLossObserved ||= holderLost()
  if (reconciliation.status === "failure") {
    return await finalizeDeadmanManual(
      handoff, "reconciliation_failed", evidence, dependencies,
    )
  }
  evidence.guardIdentityCount = reconciliation.value.guardJobId === null ? 0 : 1
  evidence.guardJobId = reconciliation.value.guardJobId
  if (holderLossObserved && reconciliation.value.terminalEvidence === null) {
    return await finalizeDeadmanManual(
      handoff, "reconciliation_failed", evidence, dependencies,
    )
  }
  if (!stopReceiptPersisted) {
    return await finalizeDeadmanManual(
      handoff, "receipt_failure", evidence, dependencies,
    )
  }
  if (!await appendReconciliationReceipt(handoff, reconciliation.value, dependencies)) {
    return await finalizeDeadmanManual(
      handoff, "receipt_failure", evidence, dependencies,
    )
  }
  holderLossObserved ||= holderLost()
  let cleanup = null
  let guardResolution: "cleaned" | "proved_absent" = "proved_absent"
  if (reconciliation.value.guardJobId !== null) {
    evidence.cleanupAttempted = true
    const cleaned = await runFreshCleanup(
      handoff, reconciliation.value.guardJobId, dependencies,
    )
    if (cleaned.status === "failure") {
      return await finalizeDeadmanManual(
        handoff, "cleanup_failed", evidence, dependencies,
      )
    }
    cleanup = cleaned.value
    guardResolution = "cleaned"
  }
  holderLossObserved ||= holderLost()
  if (!await appendCleanupReceipt(handoff, dependencies)) {
    return await finalizeDeadmanManual(
      handoff, "receipt_failure", evidence, dependencies,
    )
  }
  holderLossObserved ||= holderLost()
  let final
  try {
    final = await runFinalInactiveReadback(handoff, dependencies)
  } catch {
    return await finalizeDeadmanManual(handoff, "final_fast_failed", {
      cleanupAttempted: evidence.cleanupAttempted,
      guardIdentityCount: 0,
      guardJobId: null,
    }, dependencies)
  }
  if (final.status === "failed") {
    return await finalizeDeadmanManual(handoff, final.reason, {
      cleanupAttempted: evidence.cleanupAttempted,
      guardIdentityCount: 0,
      guardJobId: null,
    }, dependencies)
  }
  holderLossObserved ||= holderLost()
  const status: DeadmanVerifiedStatus =
    holderLossObserved
      ? "failure_recovered_by_deadman"
      : handoff.status === "bootstrap_ambiguous_deadman_fallback_pending"
      ? "bootstrap_ambiguity_reconciled"
      : handoff.status === "sampling_failed_deadman_fallback_pending"
        ? "failure_recovered_by_deadman"
        : "inactive_dry_run_verified"
  return await finalizeDeadmanSuccess(
    handoff, status, guardResolution, cleanup, final,
    reconciliation.value.terminalEvidence, dependencies,
    input.deferLockRelease === true,
  )
}
