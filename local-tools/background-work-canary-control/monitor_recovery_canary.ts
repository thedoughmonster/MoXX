import { randomBytes } from "node:crypto"

import { appendReceipt } from "./append_receipt.ts"
import { createRecoveryGeneration } from "./create_recovery_generation.ts"
import { evaluateRecoveryObservation } from "./evaluate_recovery_observation.ts"
import { DRAIN_LIMIT_MS, FAST_INTERVAL_MS, HARD_LIMIT_MS,
  PROGRESS_LIMIT_MS, RESOURCE_INTERVAL_MS } from "./recovery_constants.ts"
import type { RecoveryState } from "./recovery_types.ts"
import { runRecoveryObservation } from "./run_recovery_observation.ts"
import { waitForRecoveryBoundary } from "./wait_for_recovery_boundary.ts"

export async function monitorRecoveryCanary(
  state: RecoveryState,
): Promise<{ passed: boolean; reason: string | null }> {
  if (!state.activation) throw new Error("Recovery activation is absent")
  const started = state.activation.startedAtUtcMs
  state.lastOutstandingWork = state.activation.frozen.toastOpen +
    state.activation.frozen.routingOpen + state.activation.frozen.deliveryOpen +
    state.activation.frozen.queueReady + state.activation.frozen.dueScheduleCount
  state.lastProgressAtUtcMs = started
  for (let index = 1; index < HARD_LIMIT_MS / FAST_INTERVAL_MS; index += 1) {
    const boundary = started + index * FAST_INTERVAL_MS
    if (!await waitForRecoveryBoundary(boundary, state.signal)) {
      state.stopReason = "signal_or_lock_loss"
      return { passed: false, reason: state.stopReason }
    }
    if (Date.now() - boundary > 2_000) {
      state.stopReason = "sampling_lateness"
      return { passed: false, reason: state.stopReason }
    }
    const resourceBoundary = index * FAST_INTERVAL_MS % RESOURCE_INTERVAL_MS === 0
    let sample
    try { sample = await runRecoveryObservation(state,
      createRecoveryGeneration(randomBytes), resourceBoundary) }
    catch {
      state.stopReason = "provider_or_control_loss"
      return { passed: false, reason: state.stopReason }
    }
    state.fastSamples += 1
    if (resourceBoundary) state.resourceSamples += 1
    const evaluation = evaluateRecoveryObservation(sample, state.activation)
    state.zeroSamples = evaluation.zeroWork ? state.zeroSamples + 1 : 0
    const outstandingWork = sample.toastOpen + sample.routingOpen +
      sample.deliveryOpen + sample.queueReady + sample.dueAtStartRemaining
    if (evaluation.progress > state.lastProgress ||
      outstandingWork < state.lastOutstandingWork ||
      (state.lastOutstandingWork === 0 && outstandingWork > 0)) {
      state.lastProgress = evaluation.progress
      state.lastProgressAtUtcMs = sample.observedAtUtcMs
    }
    state.lastOutstandingWork = outstandingWork
    await appendReceipt(state.receipt, { event_type: "canary_observation",
      timestamp_utc: new Date(sample.observedAtUtcMs).toISOString(), metrics: {
        sample_kind: resourceBoundary ? "fast_and_resource" : "fast",
        status: evaluation.stopReasons.length === 0 ? "passed" : "stopped",
        generation_sha256: state.generationSha256,
        completed_count: sample.completedSinceStart, zero_samples: state.zeroSamples,
        queues: { toast_ready: sample.toastReady, routing_ready: sample.routingReady,
          delivery_ready: sample.deliveryReady, queue_ready: sample.queueReady },
        ...(resourceBoundary ? { resources: { database_bytes: sample.databaseBytes,
          cron_history_bytes: sample.cronHistoryBytes,
          wal_directory_bytes: sample.walDirectoryBytes,
          numbackends: sample.databaseBackends } } : {}),
        target: { target_run_count: sample.targetRunCount,
          target_run_failures: sample.targetRunFailures },
      } })
    if (evaluation.stopReasons.length > 0) {
      state.stopReason = evaluation.stopReasons[0]
      return { passed: false, reason: state.stopReason }
    }
    const workRemains = !evaluation.zeroWork
    if (workRemains &&
      sample.observedAtUtcMs - state.lastProgressAtUtcMs >= PROGRESS_LIMIT_MS) {
      state.stopReason = "progress_stalled"
      return { passed: false, reason: state.stopReason }
    }
    if (state.zeroSamples >= 2) return { passed: true, reason: null }
    if (sample.observedAtUtcMs - started >= DRAIN_LIMIT_MS && !evaluation.zeroWork) {
      state.stopReason = "drain_deadline"
      return { passed: false, reason: state.stopReason }
    }
  }
  state.stopReason = "hard_deadline"
  return { passed: false, reason: state.stopReason }
}
