import { randomBytes } from "node:crypto"
import { performance } from "node:perf_hooks"

import { acquireCanaryControlLock } from "./acquire_canary_control_lock.ts"
import { appendReceipt } from "./append_receipt.ts"
import { collectRuntimeEvidence } from "./collect_runtime_evidence.ts"
import { createHeldNativeProvider } from "./create_held_native_provider.ts"
import { createUtcTimer } from "./create_utc_timer.ts"
import { executeProviderQuery } from "./execute_provider_query.ts"
import { initializeReceipt } from "./initialize_receipt.ts"
import { invalidateFinalArtifact } from "./invalidate_final_artifact.ts"
import { installBoundedSignalHandlers } from "./install_bounded_signal_handlers.ts"
import { orchestrateDeadmanReconciliation } from "./orchestrate_deadman_reconciliation.ts"
import { orchestrateGuardedSampling } from "./orchestrate_guarded_sampling.ts"
import { prepareReceiptRoot } from "./prepare_receipt_root.ts"
import { prepareReleasedRuntime } from "./prepare_released_runtime.ts"
import type { CanaryProgramDependencies } from "./program_types.ts"
import { resolveRuntimeExecutables } from "./resolve_runtime_executables.ts"
import { runBoundaryScheduler } from "./run_boundary_scheduler.ts"
import { runBoundedChild } from "./run_bounded_child.ts"
import type { SamplingQueryExecutor } from "./sampling_phase_dependencies.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"
import { writeFinalArtifact } from "./write_final_artifact.ts"

export function createCanaryProgramDependencies(): CanaryProgramDependencies {
  const nowUtcMs = () => Date.now()
  const clock = { nowUtcMs }
  const timer = createUtcTimer(nowUtcMs)
  const query: SamplingQueryExecutor = (request) => executeProviderQuery(request, {
    temporaryRoot: "/tmp",
  })
  const samplingDependencies = {
    randomBytes, query, initializeReceipt, appendReceipt,
    verifyReceipt: verifyReceiptFile, schedule: runBoundaryScheduler,
    clock, timer,
  }
  const deadmanDependencies = {
    query, appendReceipt, verifyReceipt: verifyReceiptFile,
    clock, monotonicNowMs: () => performance.now(), timer,
  }
  return {
    prepareRuntime: (args, repositoryRoot) => prepareReleasedRuntime(
      args, repositoryRoot, {
        environment: process.env, nodeVersion: process.versions.node,
        runChild: runBoundedChild, resolveExecutables: resolveRuntimeExecutables,
        collectEvidence: collectRuntimeEvidence, acquireLock: acquireCanaryControlLock,
        createProvider: createHeldNativeProvider,
      },
    ),
    prepareReceiptRoot,
    runSampling: (runtime, repositoryRoot, receiptRoot, signal) =>
      orchestrateGuardedSampling({
        runtime, repositoryRoot, receiptRoot, signal, deferLockRelease: true,
      }, samplingDependencies),
    runDeadman: (handoff, signal) => orchestrateDeadmanReconciliation(
      { handoff, signal, deferLockRelease: true }, deadmanDependencies,
    ),
    appendReceipt, verifyReceipt: verifyReceiptFile,
    writeFinalArtifact, invalidateFinalArtifact,
    installSignalHandlers: () => installBoundedSignalHandlers(process),
    nowUtcMs,
  }
}
