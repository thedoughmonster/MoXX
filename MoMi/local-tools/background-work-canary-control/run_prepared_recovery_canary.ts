import { appendReceipt } from "./append_receipt.ts"
import { finalizeRecoveryCanary } from "./finalize_recovery_canary.ts"
import { initializeRecoveryState } from "./initialize_recovery_state.ts"
import { installBoundedSignalHandlers } from "./install_bounded_signal_handlers.ts"
import { monitorRecoveryCanary } from "./monitor_recovery_canary.ts"
import { prepareReceiptRoot } from "./prepare_receipt_root.ts"
import { recordRecoveryPreflightFailure } from "./record_recovery_preflight_failure.ts"
import { RecoveryPreflightFailureError } from "./recovery_preflight_failure_error.ts"
import type { RecoveryResult } from "./recovery_types.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"
import { startRecoveryCanary } from "./start_recovery_canary.ts"

export async function runPreparedRecoveryCanary(
  runtime: ReleasedRuntime, repositoryRoot: string,
): Promise<RecoveryResult> {
  const signals = installBoundedSignalHandlers(process)
  try {
    const state = await initializeRecoveryState(runtime, repositoryRoot,
      await prepareReceiptRoot(), AbortSignal.any([signals.signal, runtime.lock.lossSignal]))
    try { await startRecoveryCanary(state) } catch (error) {
      if (!state.guard) {
        if (error instanceof RecoveryPreflightFailureError) {
          try { await recordRecoveryPreflightFailure(state, error.failure) } catch {
            runtime.lock.retainUntilExit?.()
            return { exitCode: 40, stderrCode: "MANUAL_RECONCILIATION_REQUIRED",
              envelope: null }
          }
        }
        try { await runtime.lock.release() } catch { runtime.lock.retainUntilExit?.() }
        return { exitCode: 20, stderrCode: "PRE_GUARD_FAILURE", envelope: null }
      }
      state.stopReason = "activation_or_receipt_failure"
      return await finalizeRecoveryCanary(state, false)
    }
    let monitored
    try { monitored = await monitorRecoveryCanary(state) } catch {
      state.stopReason = "monitoring_failure"
      monitored = { passed: false, reason: state.stopReason }
    }
    if (!monitored.passed) {
      try { await appendReceipt(state.receipt, { event_type: "stop_requested",
        timestamp_utc: new Date().toISOString(), metrics: {
          status: "stopped", error_class: monitored.reason ?? "unknown" } }) } catch {
        state.stopReason = "receipt_failure"
      }
    }
    return await finalizeRecoveryCanary(state, monitored.passed)
  } catch {
    runtime.lock.retainUntilExit?.()
    return { exitCode: 40, stderrCode: "MANUAL_RECONCILIATION_REQUIRED", envelope: null }
  } finally { signals.remove() }
}
