import type { GuardBootstrapResult } from "./guard_bootstrap_types.ts"
import type { ResourceBaseline } from "./query_payload_types.ts"
import type { ReceiptWriterState } from "./receipt_types.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"
import type { ThresholdStopReason } from "./sample_types.ts"
import type { SamplingFailureReason, SamplingFailureStage } from "./sampling_phase_types.ts"
import type { WorkBaseline } from "./work_baseline_types.ts"

export type SamplingExecutionState = {
  runtime: ReleasedRuntime
  repositoryRoot: string
  receiptRoot: string
  signal?: AbortSignal
  deferLockRelease: boolean
  runId?: string
  receipt?: ReceiptWriterState
  currentGenerationSha256?: string
  workBaseline?: WorkBaseline
  resourceBaseline?: ResourceBaseline
  guard?: GuardBootstrapResult
  guardMayExist: boolean
  bootstrapTerminalUtcMs?: number
  startBoundaryUtcMs?: number
  samplesCompleted: number
  resourceSamplesCompleted: number
  lastObservedAtUtcMs: number | null
  lockLossObserved: boolean
  failureStage?: SamplingFailureStage
  failureReason?: SamplingFailureReason
  stopReasons: readonly ThresholdStopReason[]
}
