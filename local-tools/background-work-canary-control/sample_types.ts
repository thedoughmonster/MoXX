export type TargetJobState = {
  jobId: 2 | 3 | 4 | 11
  jobName: string
  schedule: string
  commandMd5: string
  active: boolean
}

export type GuardState = {
  jobName: string
  schedule: string
  active: boolean
}

export type FastSample = {
  observedAtUtcMs: number
  activeCronExecutions: number
  nonTargetNonGuardActiveExecutions: number
  targetJobs: readonly TargetJobState[]
  guard: GuardState
  targetExecutions: number
  targetFailures: number
  guardFailures: number
  guardRunCount: number
  missedSamples: number
  overlappingSamples: number
  toastReady: number
  toastRunning: number
  toastRetry: number
  toastDead: number
  routingReady: number
  routingRunning: number
  routingRetry: number
  routingDead: number
  deliveryReady: number
  deliveryRunning: number
  deliveryRetry: number
  deliveryDead: number
  queueReady: number
  queueDead: number
  expiredLeases: number
  longLeases: number
  openAttempts: number
  projectionReservations: number
  workerCapViolations: number
  waitingLocks: number
}

export type ResourceSample = {
  observedAtUtcMs: number
  activeCronExecutions: number
  targetRunCount: number
  targetRunFailures: number
  guardRunCount: number
  guardRunFailures: number
  guardCronHistoryEstimatedBytes: number
  totalTaskGrowthBytes: number
  databaseGrowthBytes: number
  cronHistoryGrowthBytes: number
  walDirectoryBytes: number
  waitingLocks: number
  deadlockDelta: number
  databaseBackends: number
}

export type ThresholdStopReason =
  | "active_cron_limit_exceeded"
  | "connection_limit_reached"
  | "cron_history_growth_limit_exceeded"
  | "database_growth_limit_exceeded"
  | "deadlock_detected"
  | "delivery_dead"
  | "delivery_ready_decreased"
  | "delivery_retry"
  | "delivery_running"
  | "guard_failure_detected"
  | "guard_growth_limit_exceeded"
  | "guard_run_limit_exceeded"
  | "guard_inactive"
  | "guard_identity_drift"
  | "lease_work_present"
  | "missed_sample"
  | "open_attempt_present"
  | "overlapping_sample"
  | "preactivation_cron_limit_exceeded"
  | "projection_reservation_present"
  | "queue_dead"
  | "queue_ready_decreased"
  | "routing_dead"
  | "routing_ready_decreased"
  | "routing_retry"
  | "routing_running"
  | "target_active"
  | "target_execution_present"
  | "target_failure_detected"
  | "target_identity_drift"
  | "task_growth_limit_exceeded"
  | "toast_dead"
  | "toast_ready_decreased"
  | "toast_retry"
  | "toast_running"
  | "waiting_lock_detected"
  | "wal_directory_limit_reached"
  | "worker_cap_violation"
