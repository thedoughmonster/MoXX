import { appendRecoveryClassificationBaseline } from "./append_recovery_classification_baseline.ts"
import { handleRecoveryClassificationFailure } from "./handle_recovery_classification_failure.ts"
import type {
  RecoveryClassificationDependencies,
  RecoveryClassificationResult,
} from "./recovery_classification_types.ts"
import type { RecoveryState } from "./recovery_types.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"

export async function runPreparedRecoveryClassification(
  runtime: ReleasedRuntime, repositoryRoot: string,
  dependencies: RecoveryClassificationDependencies,
): Promise<RecoveryClassificationResult> {
  const signals = dependencies.installSignalHandlers()
  let state: RecoveryState | undefined
  let published: { path: string; sha256: string } | undefined
  try {
    state = await dependencies.prepareState(runtime, repositoryRoot,
      AbortSignal.any([signals.signal, runtime.lock.lossSignal]))
    const startedAtUtcMs = dependencies.nowUtcMs()
    state.classificationReleaseTreeSha = await dependencies.collectReleaseTree(
      repositoryRoot, runtime.repository.headSha, runtime,
      dependencies.runChild, dependencies.environment,
    )
    await dependencies.appendReceipt(state.receipt, { event_type: "run_started",
      timestamp_utc: new Date(startedAtUtcMs).toISOString(), metrics: {
        project_ref: runtime.options.projectRef, status: "classification_started" } })
    const snapshot = await dependencies.runPreflight(state)
    state.signal.throwIfAborted()
    state.preflight = snapshot
    await appendRecoveryClassificationBaseline(state, snapshot)
    await dependencies.closeProvider(runtime)
    state.signal.throwIfAborted()
    const endedAtUtcMs = dependencies.nowUtcMs()
    const durationMs = Math.max(0, endedAtUtcMs - startedAtUtcMs)
    await dependencies.appendReceipt(state.receipt, { event_type: "run_completed",
      timestamp_utc: new Date(endedAtUtcMs).toISOString(), metrics: {
        status: "accepted_classification", duration_ms: durationMs } })
    const receipt = await dependencies.verifyReceipt(state.receipt.path)
    const artifact = await dependencies.writeArtifact(state, snapshot,
      { startedAtUtcMs, endedAtUtcMs, durationMs }, receipt)
    published = artifact
    state.signal.throwIfAborted()
    await dependencies.releaseLock(runtime)
    state.signal.throwIfAborted()
    return { exitCode: 0, stderrCode: null, envelope: {
      status: "accepted_classification", runId: state.runId,
      finalReceiptPath: artifact.path, finalReceiptSha256: artifact.sha256 } }
  } catch (error) {
    if (published) {
      try { await dependencies.invalidateArtifact(published) } catch {
        /* no success envelope is emitted when invalidation cannot be proved */
      }
      runtime.lock.retainUntilExit?.()
      return { exitCode: 40, stderrCode: "MANUAL_RECONCILIATION_REQUIRED", envelope: null }
    }
    return await handleRecoveryClassificationFailure(error, runtime, state, dependencies)
  } finally { signals.remove() }
}
