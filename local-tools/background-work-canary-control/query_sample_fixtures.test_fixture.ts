import { VALID_FAST_SAMPLE } from "./sample_fixtures.test_fixture.ts"

export const VALID_START_CRON_RUN_ID = 1_000

export const VALID_FAST_QUERY_SAMPLE = {
  ...VALID_FAST_SAMPLE,
  currentMaxRunId: 1_060,
  coveredAfterRunId: 0,
  maximumTargetRunId: 900,
  maximumTargetFailureRunId: 800,
  guardPresent: true,
  guardIdentityCount: 1,
  guardJobId: 20,
  guardFailureCount: 0,
} as Record<string, unknown>
delete VALID_FAST_QUERY_SAMPLE.targetExecutions
delete VALID_FAST_QUERY_SAMPLE.targetFailures
delete VALID_FAST_QUERY_SAMPLE.guardFailures
delete VALID_FAST_QUERY_SAMPLE.missedSamples
delete VALID_FAST_QUERY_SAMPLE.overlappingSamples

export const VALID_RESOURCE_QUERY_SAMPLE = {
  observedAtUtcMs: VALID_FAST_SAMPLE.observedAtUtcMs,
  activeCronExecutions: 1,
  currentMaxRunId: 1_060,
  coveredAfterRunId: 0,
  maximumTargetRunId: 900,
  maximumTargetFailureRunId: 800,
  guardIdentityCount: 1,
  guardJobId: 20,
  guardRunCount: 12,
  guardFailureCount: 0,
  databaseBytes: 8_002_000,
  cronHistoryBytes: 6_001_000,
  walDirectoryBytes: 855_638_386,
  waitingLocks: 0,
  deadlocks: 4,
  databaseBackends: 13,
}

export const VALID_RESOURCE_BASELINE = {
  maxCronRunId: VALID_START_CRON_RUN_ID,
  databaseBytes: 8_000_000,
  cronHistoryBytes: 6_000_000,
  deadlocks: 4,
}
