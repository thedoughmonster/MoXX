export const FAST_QUERY_SAMPLE_KEYS = [
  "observedAtUtcMs", "activeCronExecutions", "nonTargetNonGuardActiveExecutions",
  "currentMaxRunId", "coveredAfterRunId", "maximumTargetRunId",
  "maximumTargetFailureRunId", "targetJobs", "guardPresent", "guardIdentityCount",
  "guardJobId", "guard", "guardRunCount", "guardFailureCount",
  "toastReady", "toastRunning", "toastRetry", "toastDead", "routingReady",
  "routingRunning", "routingRetry", "routingDead", "deliveryReady",
  "deliveryRunning", "deliveryRetry", "deliveryDead", "queueReady", "queueDead",
  "expiredLeases", "longLeases", "openAttempts", "projectionReservations",
  "workerCapViolations", "waitingLocks",
] as const

export const RESOURCE_QUERY_SAMPLE_KEYS = [
  "observedAtUtcMs", "activeCronExecutions", "currentMaxRunId", "coveredAfterRunId",
  "maximumTargetRunId", "maximumTargetFailureRunId", "guardIdentityCount",
  "guardJobId", "guardRunCount", "guardFailureCount", "databaseBytes",
  "cronHistoryBytes", "walDirectoryBytes", "waitingLocks", "deadlocks",
  "databaseBackends",
] as const
