import { RecoveryPreflightFailureError } from "./recovery_preflight_failure_error.ts"
import type {
  RecoveryClassificationDependencies,
  RecoveryClassificationResult,
} from "./recovery_classification_types.ts"
import type { RecoveryState } from "./recovery_types.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"

export async function handleRecoveryClassificationFailure(
  error: unknown, runtime: ReleasedRuntime, state: RecoveryState | undefined,
  dependencies: RecoveryClassificationDependencies,
): Promise<RecoveryClassificationResult> {
  let receiptPublished = false
  if (state && error instanceof RecoveryPreflightFailureError) {
    try {
      await dependencies.recordFailure(state, error.failure)
      receiptPublished = true
    } catch { /* manual terminal below */ }
  }
  let controlsClosed = false
  try {
    await dependencies.closeControls(runtime)
    controlsClosed = true
  } catch { runtime.lock.retainUntilExit?.() }
  if (receiptPublished && controlsClosed) {
    return { exitCode: 20, stderrCode: "PRE_GUARD_FAILURE", envelope: null }
  }
  return { exitCode: 40, stderrCode: "MANUAL_RECONCILIATION_REQUIRED", envelope: null }
}
