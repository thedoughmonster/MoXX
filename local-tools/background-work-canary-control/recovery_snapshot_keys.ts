export const RECOVERY_SNAPSHOT_KEYS = [
  "observedAtUtcMs", "maxCronRunId", "targetJobs", "guardIdentityCount",
  "activeCronExecutions", "waitingLocks", "registryCount",
  "registryContractViolations", "registrySha256",
  "scheduleDueSha256", "routingCatalogCount", "routingCatalogSha256",
  "dueScheduleCount", "toastOpen", "toastReady", "toastRunning", "toastRetry",
  "toastDead", "toastFuture", "toastAttempted", "toastUnexpected", "toastPartial",
  "toastUnmatched", "toastSha256", "routingOpen", "routingReady", "routingRunning",
  "routingRetry", "routingDead", "routingInvalid", "deliveryOpen", "deliveryReady",
  "deliveryRunning", "deliveryRetry", "deliveryDead", "deliveryInvalid", "queueReady",
  "queueDead", "openAttempts", "projectionReservations", "expiredLeases", "longLeases",
  "workerCapViolations", "activeToastRouteCount", "activeRoutingRouteCount",
  "activeProjectionEdgeRouteCount", "databaseProjectionModeCount",
  "activeProjectionSubscriptionCount", "routeContractViolations", "databaseBytes", "cronHistoryBytes",
  "walDirectoryBytes", "deadlocks", "databaseBackends", "maxConnections",
  "reservedConnections",
] as const

export const RECOVERY_OBSERVATION_EXTRA_KEYS = [
  "dueAtStartRemaining", "targetRunCount", "targetRunFailures",
  "guardRunCount", "guardRunFailures",
  "invalidTargetReturns", "forbiddenTargetFourRuns", "completedSinceStart",
  "sensitiveTelemetryViolations", "staleCapabilitySuccesses",
  "producerTransactionProjectionViolations", "windowToastViolations",
] as const
