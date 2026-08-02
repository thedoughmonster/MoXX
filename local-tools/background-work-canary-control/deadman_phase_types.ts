import type { ReceiptInput, ReceiptRecord, ReceiptVerification,
  ReceiptWriterState } from "./receipt_types.ts"
import type { CleanupResult } from "./recovery_control_types.ts"
import type { ProviderQueryRequest,
  ProviderQueryResult, ReleasedRuntime } from "./runtime_adapter_types.ts"
import type { FastSample, ResourceSample } from "./sample_types.ts"
import type { SchedulerClock, SchedulerTimer } from "./schedule_types.ts"
import type { SamplingBootstrapAmbiguous, SamplingDeadmanFallback,
  SamplingSuccess } from "./sampling_phase_types.ts"
import type { DeadmanTerminalEvidence } from "./deadman_terminal_types.ts"

export type DeadmanPhaseHandoff =
  | SamplingBootstrapAmbiguous
  | SamplingDeadmanFallback
  | SamplingSuccess

export type DeadmanPhaseInput = {
  handoff: DeadmanPhaseHandoff
  signal?: AbortSignal
  deferLockRelease?: boolean
}

export type DeadmanPhaseDependencies = {
  query: <T>(request: ProviderQueryRequest<T>) => Promise<ProviderQueryResult<T>>
  appendReceipt: (
    state: ReceiptWriterState,
    input: ReceiptInput,
  ) => Promise<ReceiptRecord>
  verifyReceipt: (path: string) => Promise<ReceiptVerification>
  clock: SchedulerClock
  monotonicNowMs: () => number
  timer: SchedulerTimer
}

export type DeadmanManualReason =
  | "cleanup_failed"
  | "deadline_late_or_missed"
  | "final_fast_failed"
  | "final_resource_failed"
  | "final_threshold_failed"
  | "handoff_invalid"
  | "lock_release_failed"
  | "receipt_failure"
  | "receipt_verification_failed"
  | "reconciliation_failed"

export type DeadmanManualEvidence = {
  cleanupAttempted: boolean
  guardIdentityCount: number | null
  guardJobId: number | null
  receiptPersisted: boolean
  receiptVerified: boolean
}

export type DeadmanManualResult = {
  status: "manual_reconciliation_required"
  reason: DeadmanManualReason
  runId: string
  runtime: ReleasedRuntime
  receipt: ReceiptWriterState
  evidence: DeadmanManualEvidence
  lockReleased: false
}

export type DeadmanVerifiedStatus =
  | "bootstrap_ambiguity_reconciled"
  | "failure_recovered_by_deadman"
  | "inactive_dry_run_verified"

export type DeadmanVerifiedResult = {
  status: DeadmanVerifiedStatus
  runId: string
  guardResolution: "cleaned" | "proved_absent"
  receipt: ReceiptWriterState
  receiptVerification: ReceiptVerification
  cleanup: CleanupResult | null
  finalFast: FastSample
  finalResource: ResourceSample
  terminalEvidence: DeadmanTerminalEvidence | null
  lockReleased: boolean
}

export type DeadmanPhaseResult = DeadmanManualResult | DeadmanVerifiedResult

export type DeadmanWaitResult =
  | { status: "deadline_reached"; scheduledAtUtcMs: number; launchedAtUtcMs: number;
      cancellationObserved: boolean; holderLossObserved: boolean }
  | { status: "late_or_missed"; scheduledAtUtcMs: number; launchedAtUtcMs: number;
      cancellationObserved: boolean; holderLossObserved: boolean }
