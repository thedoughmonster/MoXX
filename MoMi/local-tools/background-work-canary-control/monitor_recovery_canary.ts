import { randomBytes } from "node:crypto"

import { appendReceipt } from "./append_receipt.ts"
import { createRecoveryGeneration } from "./create_recovery_generation.ts"
import { evaluateRecoveryObservation } from "./evaluate_recovery_observation.ts"
import { hasRecoveryMembershipDrift } from "./has_recovery_membership_drift.ts"
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
  state.lastOutstandingWork = state.activation.frozen.cohortJobOpen +
    state.activation.frozen.cohortAttemptOpen +
    state.activation.frozen.cohortRoutingOpen +
    state.activation.frozen.cohortDeliveryOpen +
    state.activation.frozen.cohortQueueOpen +
    state.activation.frozen.cohortReservationOpen +
    state.activation.frozen.dueScheduleCount
  state.lastMembershipCount = state.activation.frozen.cohortMembershipCount
  state.lastMembershipSha256 = state.activation.frozen.cohortMembershipSha256
  state.lastLineageEdgeCount = state.activation.frozen.cohortLineageEdgeCount
  state.lastLineageEdgeSha256 = state.activation.frozen.cohortLineageEdgeSha256
  state.lastCohortProof = state.activation.frozen
  state.lastProgress = state.activation.frozen.cohortTerminalCount
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
    if (hasRecoveryMembershipDrift(sample, state)) {
      evaluation.stopReasons.push("cohort_membership_drift")
    }
    state.zeroSamples = evaluation.zeroWork ? state.zeroSamples + 1 : 0
    const outstandingWork = sample.cohortJobOpen + sample.cohortAttemptOpen +
      sample.cohortRoutingOpen + sample.cohortDeliveryOpen +
      sample.cohortQueueOpen + sample.cohortReservationOpen +
      sample.dueAtStartRemaining
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
        completed_count: sample.cohortTerminalCount, zero_samples: state.zeroSamples,
        cohort_boundary_sha256: sample.cohortBoundarySha256,
        cohort_membership_count: sample.cohortMembershipCount,
        cohort_membership_sha256: sample.cohortMembershipSha256,
        prior_cohort_membership_count: sample.priorCohortMembershipCount,
        prior_cohort_membership_sha256: sample.priorCohortMembershipSha256,
        cohort_membership_addition_count: sample.cohortMembershipAdditionCount,
        cohort_membership_addition_sha256: sample.cohortMembershipAdditionSha256,
        cohort_removed_member_count: sample.cohortMissingPriorMemberCount,
        cohort_removed_member_sha256: sample.cohortMissingPriorMemberSha256,
        cohort_missing_lineage_edge_count: sample.cohortMissingPriorLineageEdgeCount,
        cohort_missing_lineage_edge_sha256: sample.cohortMissingPriorLineageEdgeSha256,
        cohort_changed_parent_count: sample.cohortChangedParentCount,
        cohort_changed_parent_sha256: sample.cohortChangedParentSha256,
        cohort_lineage_edge_count: sample.cohortLineageEdgeCount,
        cohort_lineage_edge_sha256: sample.cohortLineageEdgeSha256,
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
    state.lastMembershipCount = sample.cohortMembershipCount
    state.lastMembershipSha256 = sample.cohortMembershipSha256
    state.lastLineageEdgeCount = sample.cohortLineageEdgeCount
    state.lastLineageEdgeSha256 = sample.cohortLineageEdgeSha256
    state.lastCohortProof = sample
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
