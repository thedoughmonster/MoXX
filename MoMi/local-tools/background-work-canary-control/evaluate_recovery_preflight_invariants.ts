import { MAX_ACTIVE_CRON_EXECUTIONS, MAX_DATABASE_BACKENDS_EXCLUSIVE,
  MAX_WAL_DIRECTORY_BYTES_EXCLUSIVE } from "./sample_constants.ts"
import type { RecoveryPreflightInvariantGroups } from "./recovery_preflight_failure_types.ts"
import type { RecoverySnapshot } from "./recovery_types.ts"

export function evaluateRecoveryPreflightInvariants(
  sample: RecoverySnapshot, expectedGuardIdentityCount = 0,
): RecoveryPreflightInvariantGroups {
  const work = sample.toastOpen !== sample.toastReady || sample.toastRunning !== 0 ||
    sample.toastRetry !== 0 || sample.toastDead !== 0 || sample.toastFuture !== 0 ||
    sample.toastAttempted !== 0 || sample.toastUnexpected !== 0 ||
    sample.toastPartial !== 0 || sample.toastUnmatched !== 0 ||
    sample.routingOpen !== sample.routingReady || sample.routingRunning !== 0 ||
    sample.routingRetry !== 0 || sample.routingDead !== 0 || sample.routingInvalid !== 0 ||
    sample.deliveryOpen !== sample.deliveryReady || sample.deliveryRunning !== 0 ||
    sample.deliveryRetry !== 0 || sample.deliveryDead !== 0 || sample.deliveryInvalid !== 0
  const control = sample.targetJobs.some((job) => job.active) ||
    sample.guardIdentityCount !== expectedGuardIdentityCount || sample.waitingLocks !== 0 ||
    sample.activeCronExecutions > MAX_ACTIVE_CRON_EXECUTIONS
  const cohort = sample.cohortStartedAtUtcMs !== sample.observedAtUtcMs ||
    sample.cohortDead !== 0 || sample.cohortRetry !== 0 || sample.cohortInvalid !== 0 ||
    sample.cohortAmbiguous !== 0 || sample.cohortJobOpen !== sample.toastOpen ||
    sample.cohortRoutingOpen !== sample.routingOpen ||
    sample.cohortDeliveryOpen !== sample.deliveryOpen ||
    sample.cohortQueueOpen !== sample.queueReady ||
    sample.cohortAttemptOpen !== sample.openAttempts ||
    sample.cohortReservationOpen !== sample.projectionReservations ||
    sample.cohortMembershipCount < sample.cohortRootCount ||
    sample.cohortMissingPriorMemberCount !== 0 ||
    sample.cohortMissingPriorLineageEdgeCount !== 0 || sample.cohortChangedParentCount !== 0
  const routes = sample.activeToastRouteCount !== 1 || sample.activeRoutingRouteCount !== 1 ||
    sample.activeProjectionEdgeRouteCount !== 0 || sample.databaseProjectionModeCount !== 1 ||
    sample.activeProjectionSubscriptionCount !== 1 || sample.routeContractViolations !== 0
  const safety = sample.registryCount < 1 || sample.registryContractViolations !== 0 ||
    sample.queueDead !== 0 || sample.openAttempts !== 0 ||
    sample.projectionReservations !== 0 || sample.expiredLeases !== 0 ||
    sample.longLeases !== 0 || sample.workerCapViolations !== 0 ||
    sample.walDirectoryBytes >= MAX_WAL_DIRECTORY_BYTES_EXCLUSIVE ||
    sample.databaseBackends >= MAX_DATABASE_BACKENDS_EXCLUSIVE ||
    sample.maxConnections - sample.reservedConnections - sample.databaseBackends < 8
  return { work, control, cohort, routes, safety }
}
