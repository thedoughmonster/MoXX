export type FastParseContext = {
  expectedGuardPresent: boolean
  startCronRunId: number
  missedSamples: number
  overlappingSamples: number
}

export type ResourceBaseline = {
  maxCronRunId: number
  databaseBytes: number
  cronHistoryBytes: number
  deadlocks: number
}

export type ResourceQuerySample = {
  observedAtUtcMs: number
  activeCronExecutions: number
  currentMaxRunId: number
  coveredAfterRunId: number
  maximumTargetRunId: number
  maximumTargetFailureRunId: number
  guardIdentityCount: number
  guardJobId: number
  guardRunCount: number
  guardFailureCount: number
  databaseBytes: number
  cronHistoryBytes: number
  walDirectoryBytes: number
  waitingLocks: number
  deadlocks: number
  databaseBackends: number
}
