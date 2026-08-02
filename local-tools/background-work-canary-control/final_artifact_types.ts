import type { DeadmanManualReason, DeadmanVerifiedStatus } from "./deadman_phase_types.ts"
import type { ReceiptWriterState } from "./receipt_types.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"
import type { FastSample, ResourceSample, TargetJobState } from "./sample_types.ts"
import type { SamplingFailureReason } from "./sampling_phase_types.ts"
import type { DeadmanTerminalEvidence } from "./deadman_terminal_types.ts"

export type FinalArtifactStatus =
  | DeadmanVerifiedStatus
  | "manual_reconciliation_required"
  | "pre_guard_failure"
  | "sampling_failed_rollback_completed"

export type FinalArtifactReason = DeadmanManualReason | SamplingFailureReason | null

export type FinalTargetEvidence = {
  eventRouting: boolean | null
  toastAcquisition: boolean | null
  warehouseProjectionDatabase: boolean | null
  warehouseProjectionWakeup: boolean | null
}

export type FinalArtifact = {
  schemaVersion: 2
  runId: string
  releasedHeadSha: string
  projectRef: "xtbraqnlskmqxinjxxdn"
  terminal: { status: FinalArtifactStatus; reason: FinalArtifactReason }
  sampling: { fastCount: number | null; resourceCount: number | null }
  guard: {
    resolution: "cleaned" | "inactive" | "proved_absent" | "unknown"
    absent: boolean | null
  }
  targetsInactive: FinalTargetEvidence
  deadmanEvidence: DeadmanTerminalEvidence | null
  cumulativeEvidence: {
    guardFailures: number
    guardRunCount: number
    targetFailures: number
    targetRunCount: number
    toastReady: number
    routingReady: number
    deliveryReady: number
    queueReady: number
  } | null
  resourceEvidence: {
    cronHistoryGrowthBytes: number
    databaseBackends: number
    databaseGrowthBytes: number
    deadlockDelta: number
    guardCronHistoryEstimatedBytes: number
    totalTaskGrowthBytes: number
    waitingLocks: number
    walDirectoryBytes: number
  } | null
  receipt: { terminalHash: string }
  timestamps: { startedAtUtc: string; terminalAtUtc: string }
}

export type FinalArtifactInput = {
  runtime: ReleasedRuntime
  receipt: ReceiptWriterState
  runId: string
  status: FinalArtifactStatus
  reason: FinalArtifactReason
  fastCount: number | null
  resourceCount: number | null
  guardResolution: FinalArtifact["guard"]["resolution"]
  guardAbsent: boolean | null
  targetJobs: readonly TargetJobState[] | null
  finalFast: FastSample | null
  finalResource: ResourceSample | null
  deadmanEvidence: DeadmanTerminalEvidence | null
  terminalAtUtc: string
}

export type FinalArtifactReceipt = {
  artifact: FinalArtifact
  path: string
  sha256: string
}

export type FinalArtifactFileIdentity = {
  dev: number
  ino: number
}

export type StagedFinalArtifactReceipt = FinalArtifactReceipt & {
  bytes: string
  identity: FinalArtifactFileIdentity
}

export type FinalArtifactWriteOptions = {
  beforePublish?: () => void
  preservedInvalidated?: FinalArtifactReceipt
}
