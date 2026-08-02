import assert from "node:assert/strict"
import test from "node:test"

import { evaluateDryRunThresholds } from "./evaluate_dry_run_thresholds.ts"
import {
  MAX_CRON_HISTORY_GROWTH_BYTES,
  MAX_DATABASE_GROWTH_BYTES,
  MAX_GUARD_CRON_HISTORY_ESTIMATED_BYTES,
  MAX_GUARD_RUNS,
  MAX_TASK_GROWTH_BYTES,
  MAX_WAL_DIRECTORY_BYTES_EXCLUSIVE,
} from "./sample_constants.ts"
import {
  VALID_FAST_SAMPLE,
  VALID_RESOURCE_SAMPLE,
} from "./sample_fixtures.test_fixture.ts"
import { VALID_WORK_BASELINE } from "./work_baseline.test_fixture.ts"

test("threshold evaluation returns every typed inactive-dry-run stop reason", () => {
  const boundaryFast = structuredClone(VALID_FAST_SAMPLE)
  const boundaryResource = structuredClone(VALID_RESOURCE_SAMPLE)
  boundaryFast.activeCronExecutions = 8
  boundaryFast.nonTargetNonGuardActiveExecutions = 4
  boundaryFast.guardRunCount = MAX_GUARD_RUNS
  boundaryResource.guardRunCount = MAX_GUARD_RUNS
  boundaryResource.guardCronHistoryEstimatedBytes = MAX_GUARD_CRON_HISTORY_ESTIMATED_BYTES
  boundaryResource.totalTaskGrowthBytes = MAX_TASK_GROWTH_BYTES
  boundaryResource.databaseGrowthBytes = MAX_DATABASE_GROWTH_BYTES
  boundaryResource.cronHistoryGrowthBytes = MAX_CRON_HISTORY_GROWTH_BYTES
  boundaryResource.walDirectoryBytes = MAX_WAL_DIRECTORY_BYTES_EXCLUSIVE - 1
  boundaryResource.databaseBackends = 49
  assert.deepEqual(evaluateDryRunThresholds(
    boundaryFast, VALID_WORK_BASELINE, boundaryResource,
  ), [])

  const breaches: Array<[string, (fast: any, resource: any) => void]> = [
    ["active_cron_limit_exceeded", (fast) => { fast.activeCronExecutions = 9 }],
    ["preactivation_cron_limit_exceeded", (fast) => {
      fast.nonTargetNonGuardActiveExecutions = 5
    }],
    ["target_identity_drift", (fast) => { fast.targetJobs[0].jobName = "drift" }],
    ["target_active", (fast) => { fast.targetJobs[0].active = true }],
    ["guard_identity_drift", (fast) => { fast.guard.schedule = "10 seconds" }],
    ["guard_inactive", (fast) => { fast.guard.active = false }],
    ["target_failure_detected", (fast) => { fast.targetFailures = 1 }],
    ["target_execution_present", (fast) => { fast.targetExecutions = 1 }],
    ["guard_failure_detected", (fast) => { fast.guardFailures = 1 }],
    ["missed_sample", (fast) => { fast.missedSamples = 1 }],
    ["overlapping_sample", (fast) => { fast.overlappingSamples = 1 }],
    ["toast_running", (fast) => { fast.toastRunning = 1 }],
    ["routing_retry", (fast) => { fast.routingRetry = 1 }],
    ["delivery_dead", (fast) => { fast.deliveryDead = 1 }],
    ["queue_dead", (fast) => { fast.queueDead = 1 }],
    ["lease_work_present", (fast) => { fast.longLeases = 1 }],
    ["open_attempt_present", (fast) => { fast.openAttempts = 1 }],
    ["projection_reservation_present", (fast) => { fast.projectionReservations = 1 }],
    ["worker_cap_violation", (fast) => { fast.workerCapViolations = 1 }],
    ["waiting_lock_detected", (fast) => { fast.waitingLocks = 1 }],
    ["target_execution_present", (_fast, resource) => { resource.targetRunCount = 1 }],
    ["guard_growth_limit_exceeded", (_fast, resource) => {
      resource.guardCronHistoryEstimatedBytes =
        MAX_GUARD_CRON_HISTORY_ESTIMATED_BYTES + 1
    }],
    ["guard_run_limit_exceeded", (_fast, resource) => {
      resource.guardRunCount = MAX_GUARD_RUNS + 1
    }],
    ["task_growth_limit_exceeded", (_fast, resource) => {
      resource.totalTaskGrowthBytes = MAX_TASK_GROWTH_BYTES + 1
    }],
    ["database_growth_limit_exceeded", (_fast, resource) => {
      resource.databaseGrowthBytes = MAX_DATABASE_GROWTH_BYTES + 1
    }],
    ["cron_history_growth_limit_exceeded", (_fast, resource) => {
      resource.cronHistoryGrowthBytes = MAX_CRON_HISTORY_GROWTH_BYTES + 1
    }],
    ["wal_directory_limit_reached", (_fast, resource) => {
      resource.walDirectoryBytes = MAX_WAL_DIRECTORY_BYTES_EXCLUSIVE
    }],
    ["deadlock_detected", (_fast, resource) => { resource.deadlockDelta = 1 }],
    ["connection_limit_reached", (_fast, resource) => { resource.databaseBackends = 50 }],
  ]
  for (const [reason, breach] of breaches) {
    const fast = structuredClone(VALID_FAST_SAMPLE)
    const resource = structuredClone(VALID_RESOURCE_SAMPLE)
    breach(fast, resource)
    assert.ok(evaluateDryRunThresholds(
      fast, VALID_WORK_BASELINE, resource,
    ).includes(reason as any), reason)
  }
})
