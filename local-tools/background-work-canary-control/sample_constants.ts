export const EXPECTED_TARGET_JOBS = [
  { jobId: 2, jobName: "momi-event-routing-wakeup-v1", schedule: "3 seconds",
    commandMd5: "d1db18b38a3577efa40b514345e960d7" },
  { jobId: 3, jobName: "momi-toast-acquisition-wakeup-v1", schedule: "1 second",
    commandMd5: "2fdbc4715c4d43d48c491f292cd5ce3f" },
  { jobId: 4, jobName: "momi-warehouse-projection-wakeup-v1", schedule: "3 seconds",
    commandMd5: "a01f61a82f58583bf81c20e2a66388fb" },
  { jobId: 11, jobName: "momi-warehouse-projection-database-v1", schedule: "3 seconds",
    commandMd5: "244f8439267e4c7ceedf07d503919f91" },
] as const

export const EXPECTED_GUARD_NAME = "momi-issue-330-canary-deadman-v1"
export const EXPECTED_GUARD_SCHEDULE = "5 seconds"

export const MAX_ACTIVE_CRON_EXECUTIONS = 8
export const MAX_PREACTIVATION_OTHER_CRON = 4
export const MAX_GUARD_CRON_HISTORY_ESTIMATED_BYTES = 4 * 1024 * 1024
export const MAX_GUARD_RUNS = 828
// Conservative attribution for one guard-owned cron.job_run_details row.
export const GUARD_CRON_HISTORY_ESTIMATED_BYTES_PER_ROW = 4 * 1024
export const CRON_RUN_EVIDENCE_WINDOW_ROWS = 16_384
export const MAX_TASK_GROWTH_BYTES = 160 * 1024 * 1024
export const MAX_DATABASE_GROWTH_BYTES = 167_772_160
export const MAX_CRON_HISTORY_GROWTH_BYTES = 167_772_160
export const MAX_WAL_DIRECTORY_BYTES_EXCLUSIVE = 4_294_967_296
export const MAX_DATABASE_BACKENDS_EXCLUSIVE = 50

export const FAST_SAMPLE_KEYS = [
  "observedAtUtcMs", "activeCronExecutions", "nonTargetNonGuardActiveExecutions",
  "targetJobs", "guard", "targetExecutions", "targetFailures", "guardFailures",
  "guardRunCount", "missedSamples", "overlappingSamples", "toastReady",
  "toastRunning", "toastRetry", "toastDead",
  "routingReady", "routingRunning", "routingRetry", "routingDead", "deliveryReady",
  "deliveryRunning", "deliveryRetry", "deliveryDead", "queueReady", "queueDead",
  "expiredLeases", "longLeases", "openAttempts", "projectionReservations",
  "workerCapViolations", "waitingLocks",
] as const

export const RESOURCE_SAMPLE_KEYS = [
  "observedAtUtcMs", "activeCronExecutions", "targetRunCount", "targetRunFailures",
  "guardRunCount", "guardRunFailures", "guardCronHistoryEstimatedBytes",
  "totalTaskGrowthBytes", "databaseGrowthBytes", "cronHistoryGrowthBytes",
  "walDirectoryBytes", "waitingLocks", "deadlockDelta", "databaseBackends",
] as const
