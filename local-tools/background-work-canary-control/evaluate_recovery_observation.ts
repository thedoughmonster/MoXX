import { MAX_ACTIVE_CRON_EXECUTIONS, MAX_CRON_HISTORY_GROWTH_BYTES,
  MAX_DATABASE_BACKENDS_EXCLUSIVE, MAX_DATABASE_GROWTH_BYTES,
  MAX_GUARD_RUNS, MAX_WAL_DIRECTORY_BYTES_EXCLUSIVE } from "./sample_constants.ts"
import type { RecoveryActivation, RecoveryObservation } from "./recovery_types.ts"

export function evaluateRecoveryObservation(
  sample: RecoveryObservation, activation: RecoveryActivation,
): { stopReasons: string[]; zeroWork: boolean; progress: number } {
  const baseline = activation.frozen
  const reasons: string[] = []
  if (sample.registrySha256 !== baseline.registrySha256 ||
    sample.registryCount !== baseline.registryCount ||
    sample.registryContractViolations !== 0) reasons.push("registry_drift")
  if (sample.routingCatalogSha256 !== baseline.routingCatalogSha256 ||
    sample.routingCatalogCount !== baseline.routingCatalogCount) {
    reasons.push("routing_catalog_drift")
  }
  if (sample.targetJobs.find((job) => job.jobId === 4)?.active !== false ||
    sample.targetJobs.filter((job) => job.jobId !== 4).some((job) => !job.active)) {
    reasons.push("target_state_drift")
  }
  if (sample.guardIdentityCount !== 1) reasons.push("guard_identity_drift")
  if (sample.toastRetry || sample.toastDead || sample.toastFuture || sample.toastUnmatched ||
    sample.toastUnexpected !== sample.toastRunning ||
    sample.toastAttempted !== sample.toastRunning || sample.toastPartial !== sample.toastRunning) {
    reasons.push("toast_work_invalid")
  }
  if (sample.routingRetry || sample.routingDead ||
    sample.routingInvalid !== sample.routingRunning) reasons.push("routing_work_invalid")
  if (sample.deliveryRetry || sample.deliveryDead ||
    sample.deliveryInvalid !== sample.deliveryRunning) reasons.push("delivery_work_invalid")
  if (sample.queueDead || sample.targetRunFailures || sample.guardRunFailures ||
    sample.guardRunCount > MAX_GUARD_RUNS || sample.invalidTargetReturns ||
    sample.forbiddenTargetFourRuns || sample.sensitiveTelemetryViolations ||
    sample.staleCapabilitySuccesses || sample.producerTransactionProjectionViolations) {
    reasons.push("execution_evidence_invalid")
  }
  if (sample.windowToastViolations) reasons.push("window_work_invalid")
  if (sample.openAttempts || sample.projectionReservations || sample.expiredLeases ||
    sample.longLeases || sample.workerCapViolations || sample.waitingLocks) {
    reasons.push("control_or_lease_violation")
  }
  if (sample.activeToastRouteCount !== 1 || sample.activeRoutingRouteCount !== 1 ||
    sample.activeProjectionEdgeRouteCount !== 0 || sample.databaseProjectionModeCount !== 1 ||
    sample.activeProjectionSubscriptionCount !== 1 || sample.routeContractViolations !== 0) {
    reasons.push("route_drift")
  }
  if (sample.activeCronExecutions > MAX_ACTIVE_CRON_EXECUTIONS ||
    sample.databaseBackends >= MAX_DATABASE_BACKENDS_EXCLUSIVE ||
    sample.maxConnections - sample.reservedConnections - sample.databaseBackends < 8 ||
    sample.walDirectoryBytes >= MAX_WAL_DIRECTORY_BYTES_EXCLUSIVE ||
    sample.databaseBytes - baseline.databaseBytes > MAX_DATABASE_GROWTH_BYTES ||
    sample.cronHistoryBytes - baseline.cronHistoryBytes > MAX_CRON_HISTORY_GROWTH_BYTES ||
    sample.deadlocks !== baseline.deadlocks || sample.maxCronRunId < baseline.maxCronRunId ||
    sample.maxCronRunId - baseline.maxCronRunId > 16_384) reasons.push("resource_threshold")
  const zeroWork = sample.toastOpen === 0 && sample.routingOpen === 0 &&
    sample.deliveryOpen === 0 && sample.queueReady === 0 && sample.openAttempts === 0 &&
    sample.projectionReservations === 0 && sample.dueAtStartRemaining === 0
  return { stopReasons: reasons, zeroWork, progress: sample.completedSinceStart }
}
