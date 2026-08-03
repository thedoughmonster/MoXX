import type { RecoveryObservation, RecoverySnapshot } from "./recovery_types.ts"
import { EXPECTED_TARGET_JOBS } from "./sample_constants.ts"

export function createRecoverySnapshotFixture(
  override: Partial<RecoveryObservation> = {},
): RecoveryObservation {
  const base: RecoverySnapshot = {
    observedAtUtcMs: 1_785_752_000_000, maxCronRunId: 100,
    targetJobs: EXPECTED_TARGET_JOBS.map((job) => ({ ...job, active: job.jobId !== 4 })),
    guardIdentityCount: 1, activeCronExecutions: 4, waitingLocks: 0,
    registryCount: 49, registryContractViolations: 0,
    registrySha256: "a".repeat(64),
    scheduleDueSha256: "c".repeat(64), dueScheduleCount: 0,
    toastOpen: 1, toastReady: 1, toastRunning: 0, toastRetry: 0, toastDead: 0,
    toastFuture: 0, toastAttempted: 0, toastUnexpected: 0, toastPartial: 0,
    toastUnmatched: 0, toastSha256: "b".repeat(64), routingOpen: 0,
    routingReady: 0, routingRunning: 0, routingRetry: 0, routingDead: 0,
    routingInvalid: 0, deliveryOpen: 0, deliveryReady: 0, deliveryRunning: 0,
    deliveryRetry: 0, deliveryDead: 0, deliveryInvalid: 0, queueReady: 0,
    queueDead: 0, openAttempts: 0, projectionReservations: 0, expiredLeases: 0,
    longLeases: 0, workerCapViolations: 0, activeToastRouteCount: 1,
    activeRoutingRouteCount: 1, activeProjectionEdgeRouteCount: 0,
    databaseProjectionModeCount: 1, activeProjectionSubscriptionCount: 1,
    routeContractViolations: 0,
    databaseBytes: 8_000_000_000, cronHistoryBytes: 6_000_000_000,
    walDirectoryBytes: 800_000_000, deadlocks: 0, databaseBackends: 8,
    maxConnections: 60, reservedConnections: 3,
  }
  return { ...base, dueAtStartRemaining: 0, targetRunCount: 1,
    targetRunFailures: 0, invalidTargetReturns: 0, forbiddenTargetFourRuns: 0,
    guardRunCount: 1, guardRunFailures: 0,
    completedSinceStart: 1, sensitiveTelemetryViolations: 0,
    staleCapabilitySuccesses: 0, producerTransactionProjectionViolations: 0,
    windowToastViolations: 0,
    ...override }
}
