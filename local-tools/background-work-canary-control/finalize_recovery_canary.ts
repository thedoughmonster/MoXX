import { appendRecoveryReceiptSafe } from "./append_recovery_receipt_safe.ts"
import { invalidateRecoveryArtifact } from "./invalidate_recovery_artifact.ts"
import type { RecoveryResult, RecoveryState } from "./recovery_types.ts"
import { runRecoveryCleanup } from "./run_recovery_cleanup.ts"
import { runRecoveryDeadman } from "./run_recovery_deadman.ts"
import { runRecoveryFinal } from "./run_recovery_final.ts"
import { runRecoveryRollback } from "./run_recovery_rollback.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"
import { writeRecoveryArtifact } from "./write_recovery_artifact.ts"

export async function finalizeRecoveryCanary(
  state: RecoveryState, passed: boolean,
): Promise<RecoveryResult> {
  let published: { path: string; sha256: string } | undefined
  let cleanupAlreadyCompleted = false
  let receiptHealthy = await appendRecoveryReceiptSafe(state, {
    event_type: "rollback_started", timestamp_utc: new Date().toISOString(),
    metrics: { status: "started", rollback_invoked: true } })
  try {
    try {
      await runRecoveryRollback(state)
      state.recoveryPath = "explicit_rollback"
    } catch {
      try { await runRecoveryCleanup(state); cleanupAlreadyCompleted = true } catch {
        if (!await runRecoveryDeadman(state)) throw new Error("Dead-man recovery was not proven")
        state.recoveryPath = "deadman"
        receiptHealthy = await appendRecoveryReceiptSafe(state, { event_type: "deadman_reconciled",
          timestamp_utc: new Date().toISOString(), metrics: {
            status: "reconciled", generation_sha256: state.generationSha256 } }) && receiptHealthy
      }
      if (cleanupAlreadyCompleted) state.recoveryPath = "rollback_readback_cleanup"
    }
    receiptHealthy = await appendRecoveryReceiptSafe(state, { event_type: "rollback_completed",
      timestamp_utc: new Date().toISOString(), metrics: {
        status: state.deadmanReconciled ? "reconciled" :
          cleanupAlreadyCompleted ? "rollback_and_cleanup_read_back" : "inactive",
        target: { active_after_mask: 0, exact_identity_mask: 15,
          inactive_after_mask: 15 } } }) &&
      receiptHealthy
    if (!cleanupAlreadyCompleted) await runRecoveryCleanup(state)
    receiptHealthy = await appendRecoveryReceiptSafe(state, { event_type: "cleanup_completed",
      timestamp_utc: new Date().toISOString(), metrics: { status: "guard_absent",
        guard: { guard_active: false } } }) &&
      receiptHealthy
    const final = await runRecoveryFinal(state)
    const disposition = passed ? "passed" : "stopped_recovered"
    receiptHealthy = await appendRecoveryReceiptSafe(state, { event_type: "run_completed",
      timestamp_utc: new Date().toISOString(), metrics: { status: disposition,
        count: state.fastSamples, zero_samples: state.zeroSamples,
        waiting_locks: final.waitingLocks,
        target: { exact_identity_mask: 15, inactive_after_mask: 15 },
        guard: { guard_active: false } } }) && receiptHealthy
    if (!receiptHealthy) {
      await state.runtime.lock.release()
      return { exitCode: 40, stderrCode: "MANUAL_RECONCILIATION_REQUIRED", envelope: null }
    }
    const verified = await verifyReceiptFile(state.receipt.path)
    await state.runtime.provider.close()
    if (state.runtime.provider.status() !== "closed") {
      throw new Error("Recovery provider did not close")
    }
    const artifact = await writeRecoveryArtifact(state, disposition, final, verified, Date.now(),
      () => {
        if (state.runtime.lock.status() !== "held" || state.runtime.lock.lossSignal.aborted) {
          throw new Error("Recovery lifecycle lock was lost before publication")
        }
      })
    published = artifact
    await state.runtime.lock.release()
    if (state.runtime.lock.status() !== "released" || state.runtime.lock.lossSignal.aborted) {
      throw new Error("Recovery lifecycle lock release was not acknowledged")
    }
    return { exitCode: passed ? 0 : 30,
      stderrCode: passed ? null : "RECOVERED_BUT_UNSUCCESSFUL",
      envelope: { status: disposition, runId: state.runId,
        finalReceiptPath: artifact.path, finalReceiptSha256: artifact.sha256 } }
  } catch {
    if (published) {
      try { await invalidateRecoveryArtifact(published) } catch {
        /* no success envelope is emitted when invalidation cannot be proven */
      }
    }
    state.runtime.lock.retainUntilExit?.()
    return { exitCode: 40, stderrCode: "MANUAL_RECONCILIATION_REQUIRED", envelope: null }
  }
}
