import { appendReceipt } from "./append_receipt.ts"
import { closeRecoveryClassificationControls } from "./close_recovery_classification_controls.ts"
import { closeRecoveryClassificationProvider } from "./close_recovery_classification_provider.ts"
import { collectReleaseTreeSha } from "./collect_release_tree_sha.ts"
import { initializeRecoveryState } from "./initialize_recovery_state.ts"
import { installBoundedSignalHandlers } from "./install_bounded_signal_handlers.ts"
import { invalidateRecoveryClassificationArtifact } from "./invalidate_recovery_classification_artifact.ts"
import { prepareCanaryRuntime } from "./prepare_canary_runtime.ts"
import { prepareReceiptRoot } from "./prepare_receipt_root.ts"
import { recordRecoveryPreflightFailure } from "./record_recovery_preflight_failure.ts"
import { releaseRecoveryClassificationLock } from "./release_recovery_classification_lock.ts"
import type { RecoveryClassificationDependencies } from "./recovery_classification_types.ts"
import { runRecoveryPreflight } from "./run_recovery_preflight.ts"
import { runBoundedChild } from "./run_bounded_child.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"
import { writeRecoveryClassificationArtifact } from "./write_recovery_classification_artifact.ts"

export function createRecoveryClassificationDependencies(): RecoveryClassificationDependencies {
  return {
    prepareRuntime: prepareCanaryRuntime,
    prepareState: async (runtime, repositoryRoot, signal) => initializeRecoveryState(
      runtime, repositoryRoot, await prepareReceiptRoot(), signal,
    ),
    runPreflight: runRecoveryPreflight,
    collectReleaseTree: (repositoryRoot, releaseSha, runtime, runner, environment) =>
      collectReleaseTreeSha(repositoryRoot, releaseSha, runtime.executables, runner, environment),
    runChild: runBoundedChild, environment: process.env,
    appendReceipt, recordFailure: recordRecoveryPreflightFailure,
    verifyReceipt: verifyReceiptFile,
    writeArtifact: writeRecoveryClassificationArtifact,
    closeProvider: closeRecoveryClassificationProvider,
    releaseLock: releaseRecoveryClassificationLock,
    invalidateArtifact: invalidateRecoveryClassificationArtifact,
    closeControls: closeRecoveryClassificationControls,
    installSignalHandlers: () => installBoundedSignalHandlers(process),
    nowUtcMs: () => Date.now(),
  }
}
