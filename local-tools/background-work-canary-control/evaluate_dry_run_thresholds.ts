import {
  EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS,
  MAX_ACTIVE_CRON_EXECUTIONS,
  MAX_CRON_HISTORY_GROWTH_BYTES,
  MAX_DATABASE_BACKENDS_EXCLUSIVE,
  MAX_DATABASE_GROWTH_BYTES,
  MAX_GUARD_CRON_HISTORY_ESTIMATED_BYTES,
  MAX_GUARD_RUNS,
  MAX_PREACTIVATION_OTHER_CRON,
  MAX_TASK_GROWTH_BYTES,
  MAX_WAL_DIRECTORY_BYTES_EXCLUSIVE,
} from "./sample_constants.ts"
import type { FastSample, ResourceSample, ThresholdStopReason } from "./sample_types.ts"
import type { WorkBaseline } from "./work_baseline_types.ts"

export function evaluateDryRunThresholds(
  fast: FastSample,
  baseline: WorkBaseline,
  resource?: ResourceSample,
): ThresholdStopReason[] {
  const reasons = new Set<ThresholdStopReason>()
  if (fast.activeCronExecutions > MAX_ACTIVE_CRON_EXECUTIONS) {
    reasons.add("active_cron_limit_exceeded")
  }
  if (fast.nonTargetNonGuardActiveExecutions > MAX_PREACTIVATION_OTHER_CRON) {
    reasons.add("preactivation_cron_limit_exceeded")
  }
  if (fast.targetJobs.length !== EXPECTED_TARGET_JOBS.length) {
    reasons.add("target_identity_drift")
  }
  for (const [index, expected] of EXPECTED_TARGET_JOBS.entries()) {
    const actual = fast.targetJobs[index]
    if (!actual || actual.jobId !== expected.jobId || actual.jobName !== expected.jobName ||
      actual.schedule !== expected.schedule || actual.commandMd5 !== expected.commandMd5) {
      reasons.add("target_identity_drift")
    }
    if (actual?.active) reasons.add("target_active")
  }
  if (fast.guard.jobName !== EXPECTED_GUARD_NAME ||
    fast.guard.schedule !== EXPECTED_GUARD_SCHEDULE) reasons.add("guard_identity_drift")
  if (!fast.guard.active) reasons.add("guard_inactive")
  if (fast.targetFailures > 0) reasons.add("target_failure_detected")
  if (fast.targetExecutions > 0) reasons.add("target_execution_present")
  if (fast.guardFailures > 0) reasons.add("guard_failure_detected")
  if (fast.guardRunCount > MAX_GUARD_RUNS) reasons.add("guard_run_limit_exceeded")
  if (fast.missedSamples > 0) reasons.add("missed_sample")
  if (fast.overlappingSamples > 0) reasons.add("overlapping_sample")
  if (fast.toastReady < baseline.toastReady) reasons.add("toast_ready_decreased")
  if (fast.toastRunning > 0) reasons.add("toast_running")
  if (fast.toastRetry > 0) reasons.add("toast_retry")
  if (fast.toastDead > 0) reasons.add("toast_dead")
  if (fast.routingReady < baseline.routingReady) reasons.add("routing_ready_decreased")
  if (fast.routingRunning > 0) reasons.add("routing_running")
  if (fast.routingRetry > 0) reasons.add("routing_retry")
  if (fast.routingDead > 0) reasons.add("routing_dead")
  if (fast.deliveryReady < baseline.deliveryReady) reasons.add("delivery_ready_decreased")
  if (fast.deliveryRunning > 0) reasons.add("delivery_running")
  if (fast.deliveryRetry > 0) reasons.add("delivery_retry")
  if (fast.deliveryDead > 0) reasons.add("delivery_dead")
  if (fast.queueReady < baseline.queueReady) reasons.add("queue_ready_decreased")
  if (fast.queueDead > 0) reasons.add("queue_dead")
  if (fast.expiredLeases + fast.longLeases > 0) reasons.add("lease_work_present")
  if (fast.openAttempts > 0) reasons.add("open_attempt_present")
  if (fast.projectionReservations > 0) reasons.add("projection_reservation_present")
  if (fast.workerCapViolations > 0) reasons.add("worker_cap_violation")
  if (fast.waitingLocks > 0) reasons.add("waiting_lock_detected")
  if (!resource) return [...reasons]
  if (resource.activeCronExecutions > MAX_ACTIVE_CRON_EXECUTIONS) {
    reasons.add("active_cron_limit_exceeded")
  }
  if (resource.targetRunCount > 0) reasons.add("target_execution_present")
  if (resource.targetRunFailures > 0) reasons.add("target_failure_detected")
  if (resource.guardRunCount > MAX_GUARD_RUNS) reasons.add("guard_run_limit_exceeded")
  if (resource.guardRunFailures > 0) reasons.add("guard_failure_detected")
  if (resource.guardCronHistoryEstimatedBytes > MAX_GUARD_CRON_HISTORY_ESTIMATED_BYTES) {
    reasons.add("guard_growth_limit_exceeded")
  }
  if (resource.totalTaskGrowthBytes > MAX_TASK_GROWTH_BYTES) {
    reasons.add("task_growth_limit_exceeded")
  }
  if (resource.databaseGrowthBytes > MAX_DATABASE_GROWTH_BYTES) {
    reasons.add("database_growth_limit_exceeded")
  }
  if (resource.cronHistoryGrowthBytes > MAX_CRON_HISTORY_GROWTH_BYTES) {
    reasons.add("cron_history_growth_limit_exceeded")
  }
  if (resource.walDirectoryBytes >= MAX_WAL_DIRECTORY_BYTES_EXCLUSIVE) {
    reasons.add("wal_directory_limit_reached")
  }
  if (resource.waitingLocks > 0) reasons.add("waiting_lock_detected")
  if (resource.deadlockDelta > 0) reasons.add("deadlock_detected")
  if (resource.databaseBackends >= MAX_DATABASE_BACKENDS_EXCLUSIVE) {
    reasons.add("connection_limit_reached")
  }
  return [...reasons]
}
