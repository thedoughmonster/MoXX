import { appendRollbackReceipt } from "./append_rollback_receipt.ts"
import { appendSamplingFailureReceipt } from "./append_sampling_failure_receipt.ts"
import { buildAmbiguousBootstrapContext } from "./build_ambiguous_bootstrap_context.ts"
import { buildGuardedSamplingContext } from "./build_guarded_sampling_context.ts"
import { runFreshRollback } from "./run_fresh_rollback.ts"
import type { SamplingExecutionState } from "./sampling_execution_state.ts"
import type { SamplingPhaseDependencies } from "./sampling_phase_dependencies.ts"
import { SamplingPhaseError } from "./sampling_phase_error.ts"
import type { SamplingPhaseResult } from "./sampling_phase_types.ts"

export async function coordinateSamplingFailure(
  state: SamplingExecutionState,
  dependencies: SamplingPhaseDependencies,
  error: unknown,
): Promise<SamplingPhaseResult> {
  const failure = error instanceof SamplingPhaseError
    ? error : new SamplingPhaseError("sampling", "unexpected_failure")
  state.failureStage = failure.stage
  state.failureReason = failure.reason
  await appendSamplingFailureReceipt(state, dependencies, failure.reason, Boolean(state.guard))
  if (state.guardMayExist && !state.guard) {
    return buildAmbiguousBootstrapContext(state, failure.reason)
  }
  if (!state.guard) {
    let receiptVerified = false
    if (state.receipt && !state.receipt.poisoned) {
      try {
        await dependencies.verifyReceipt(state.receipt.path)
        receiptVerified = true
      } catch {
        receiptVerified = false
      }
    }
    let lockReleased = false
    if (!state.deferLockRelease) {
      try {
        await state.runtime.lock.release()
        lockReleased = true
      } catch {
        lockReleased = false
      }
    }
    return {
      status: "pre_guard_failure", stage: failure.stage, reason: failure.reason,
      runId: state.runId ?? null,
      ...(state.deferLockRelease && state.receipt ? { receipt: state.receipt } : {}),
      receiptVerified, lockReleased,
    }
  }
  await appendRollbackReceipt(state, dependencies, "rollback_started")
  const rollback = await runFreshRollback(state, dependencies)
  if (rollback.status === "failure") {
    await appendSamplingFailureReceipt(
      state, dependencies, "provider_deadman_fallback_pending", true,
    )
    return {
      ...buildGuardedSamplingContext(state),
      status: "sampling_failed_deadman_fallback_pending",
      stage: "rollback", reason: rollback.reason,
      stopReasons: state.stopReasons, lockReleased: false,
    }
  }
  await appendRollbackReceipt(state, dependencies, "rollback_completed")
  let receiptVerified = false
  if (state.receipt && !state.receipt.poisoned) {
    try {
      await dependencies.verifyReceipt(state.receipt.path)
      receiptVerified = true
    } catch {
      receiptVerified = false
    }
  }
  let lockReleased = false
  if (!state.deferLockRelease) {
    try {
      await state.runtime.lock.release()
      lockReleased = true
    } catch {
      lockReleased = false
    }
  }
  return {
    status: "sampling_failed_rollback_completed",
    stage: failure.stage, reason: failure.reason, runId: state.runId!,
    receipt: state.receipt!, receiptVerified, rollback: rollback.value,
    samplesCompleted: state.samplesCompleted,
    resourceSamplesCompleted: state.resourceSamplesCompleted,
    stopReasons: state.stopReasons, lockReleased,
  }
}
