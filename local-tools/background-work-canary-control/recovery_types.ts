import type { GuardBootstrapResult } from "./guard_bootstrap_types.ts"
import type { ReceiptWriterState } from "./receipt_types.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"
import type { TargetJobState } from "./sample_types.ts"

export type RecoveryDueOccurrence = {
  scheduleKey: string
  dueAtUtcMs: number
}

export type RecoverySnapshot = {
  observedAtUtcMs: number; cohortStartedAtUtcMs: number
  jobHighWater: number; observationHighWater: number
  dueOccurrences: readonly RecoveryDueOccurrence[]; cohortBoundarySha256: string
  cohortRootCount: number; cohortRootSha256: string
  toastRootCount: number; toastRootSha256: string
  routingRootCount: number; routingRootSha256: string
  deliveryRootCount: number; deliveryRootSha256: string
  queueMappingCount: number; queueMappingSha256: string
  cohortMembershipCount: number; cohortMembershipSha256: string
  cohortLineageEdgeCount: number; cohortLineageEdgeSha256: string
  cohortJobCount: number; cohortJobOpen: number
  cohortAttemptCount: number; cohortAttemptOpen: number
  cohortObservationCount: number; cohortEventCount: number
  cohortRoutingCount: number; cohortRoutingOpen: number
  cohortDeliveryCount: number; cohortDeliveryOpen: number
  cohortQueueOpen: number; cohortReservationOpen: number
  cohortDead: number; cohortRetry: number; cohortInvalid: number
  cohortAmbiguous: number; cohortEmittableParents: number
  cohortTerminalCount: number
  maxCronRunId: number; targetJobs: readonly TargetJobState[]
  guardIdentityCount: number; activeCronExecutions: number; waitingLocks: number
  registryCount: number; registryContractViolations: number
  registrySha256: string; scheduleDueSha256: string
  routingCatalogCount: number; routingCatalogSha256: string; dueScheduleCount: number
  toastOpen: number; toastReady: number; toastRunning: number; toastRetry: number
  toastDead: number; toastFuture: number; toastAttempted: number
  toastUnexpected: number; toastPartial: number; toastUnmatched: number
  toastSha256: string; routingOpen: number; routingReady: number
  routingRunning: number; routingRetry: number; routingDead: number
  routingInvalid: number; deliveryOpen: number; deliveryReady: number
  deliveryRunning: number; deliveryRetry: number; deliveryDead: number
  deliveryInvalid: number; queueReady: number; queueDead: number
  openAttempts: number; projectionReservations: number; expiredLeases: number
  longLeases: number; workerCapViolations: number; activeToastRouteCount: number
  activeRoutingRouteCount: number; activeProjectionEdgeRouteCount: number
  databaseProjectionModeCount: number; activeProjectionSubscriptionCount: number
  routeContractViolations: number
  databaseBytes: number; cronHistoryBytes: number; walDirectoryBytes: number
  deadlocks: number; databaseBackends: number; maxConnections: number
  reservedConnections: number
}

export type RecoveryActivation = {
  startedAtUtcMs: number; frozen: RecoverySnapshot
  targetJobs: readonly TargetJobState[]; guardJobId: number
  generationSha256: string; guardCommandSha256: string
}

export type RecoveryObservation = RecoverySnapshot & {
  dueAtStartRemaining: number; targetRunCount: number; targetRunFailures: number
  guardRunCount: number; guardRunFailures: number
  invalidTargetReturns: number; forbiddenTargetFourRuns: number
  completedSinceStart: number; sensitiveTelemetryViolations: number
  staleCapabilitySuccesses: number; producerTransactionProjectionViolations: number
  windowToastViolations: number
}

export type RecoveryState = {
  runtime: ReleasedRuntime; repositoryRoot: string; receiptRoot: string
  signal: AbortSignal; receipt: ReceiptWriterState; runId: string
  generationSha256: string; guard?: GuardBootstrapResult
  guardStartCronRunId?: number
  attemptedGenerationSha256?: string
  preflight?: RecoverySnapshot; activation?: RecoveryActivation
  finalGenerationSha256?: string
  deadmanReconciled?: boolean
  recoveryPath?: "explicit_rollback" | "rollback_readback_cleanup" | "deadman"
  fastSamples: number; resourceSamples: number; zeroSamples: number
  lastProgress: number; lastOutstandingWork: number
  lastMembershipCount: number; lastMembershipSha256: string
  lastLineageEdgeCount: number; lastLineageEdgeSha256: string
  lastProgressAtUtcMs: number; stopReason?: string
}

export type RecoveryDisposition = "passed" | "stopped_recovered" | "manual_reconciliation_required"

export type RecoveryResult = {
  exitCode: 0 | 20 | 30 | 40; stderrCode: "PRE_GUARD_FAILURE" |
    "RECOVERED_BUT_UNSUCCESSFUL" | "MANUAL_RECONCILIATION_REQUIRED" | null
  envelope: null | { status: RecoveryDisposition; runId: string
    finalReceiptPath: string; finalReceiptSha256: string }
}
