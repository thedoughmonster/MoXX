import type { GuardBootstrapResult } from "./guard_bootstrap_types.ts"
import type { ResourceBaseline } from "./query_payload_types.ts"
import type { ReceiptWriterState } from "./receipt_types.ts"
import type { RollbackResult } from "./recovery_control_types.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"
import type { ThresholdStopReason } from "./sample_types.ts"
import type { WorkBaseline } from "./work_baseline_types.ts"
import type { EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE } from "./sample_constants.ts"

export type SamplingFailureStage =
  | "bootstrap"
  | "identity"
  | "preflight_fast"
  | "preflight_resource"
  | "receipt"
  | "rollback"
  | "sampling"

export type SamplingFailureReason =
  | "adapter_failure"
  | "cancelled"
  | "evaluate_deadline_exceeded"
  | "exit_failure"
  | "identity_failure"
  | "launch_lateness_exceeded"
  | "lifecycle_lock_lost"
  | "missing_boundary"
  | "output_limit"
  | "parse_deadline_exceeded"
  | "preflight_rejected"
  | "provider_deadline_exceeded"
  | "receipt_deadline_exceeded"
  | "receipt_failure"
  | "sample_lifecycle_failed"
  | "sample_overlap"
  | "sample_stage_order_invalid"
  | "schema_failure"
  | "signalled"
  | "threshold_stop"
  | "timed_out"
  | "unexpected_failure"

export type GuardedSamplingContext = {
  runtime: ReleasedRuntime
  repositoryRoot: string
  runId: string
  receipt: ReceiptWriterState
  guard: GuardBootstrapResult
  currentGenerationSha256: string
  workBaseline: WorkBaseline
  resourceBaseline: ResourceBaseline
  startBoundaryUtcMs: number | null
  samplesCompleted: number
  resourceSamplesCompleted: number
  lastObservedAtUtcMs: number | null
}

export type SamplingSuccess = GuardedSamplingContext & {
  status: "sampling_complete_waiting_for_synthetic_loss"
  startBoundaryUtcMs: number
  samplesCompleted: 21
  resourceSamplesCompleted: 6
}

export type SamplingPreGuardFailure = {
  status: "pre_guard_failure"
  stage: SamplingFailureStage
  reason: SamplingFailureReason
  runId: string | null
  receipt?: ReceiptWriterState
  receiptVerified: boolean
  lockReleased: boolean
}

export type SamplingRollbackFailure = {
  status: "sampling_failed_rollback_completed"
  stage: SamplingFailureStage
  reason: SamplingFailureReason
  runId: string
  receipt: ReceiptWriterState
  receiptVerified: boolean
  samplesCompleted: number
  resourceSamplesCompleted: number
  rollback: RollbackResult
  stopReasons: readonly ThresholdStopReason[]
  lockReleased: boolean
}

export type SamplingBootstrapAmbiguous = {
  status: "bootstrap_ambiguous_deadman_fallback_pending"
  stage: SamplingFailureStage
  reason: SamplingFailureReason
  runtime: ReleasedRuntime
  repositoryRoot: string
  runId: string
  receipt: ReceiptWriterState
  attemptedGenerationSha256: string
  bootstrapTerminalUtcMs: number
  workBaseline: WorkBaseline
  resourceBaseline: ResourceBaseline
  guardName: typeof EXPECTED_GUARD_NAME
  guardSchedule: typeof EXPECTED_GUARD_SCHEDULE
  lockReleased: false
}

export type SamplingDeadmanFallback = GuardedSamplingContext & {
  status: "sampling_failed_deadman_fallback_pending"
  stage: SamplingFailureStage
  reason: SamplingFailureReason
  stopReasons: readonly ThresholdStopReason[]
  lockReleased: false
}

export type SamplingPhaseResult =
  | SamplingSuccess
  | SamplingPreGuardFailure
  | SamplingRollbackFailure
  | SamplingDeadmanFallback
  | SamplingBootstrapAmbiguous
