import type { ReceiptInput, ReceiptRecord, ReceiptVerification,
  ReceiptWriterState } from "./receipt_types.ts"
import type { ProviderQueryRequest, ProviderQueryResult,
  ReleasedRuntime } from "./runtime_adapter_types.ts"
import type { SchedulerClock, SchedulerDependencies, SchedulerResult,
  SchedulerTimer, SampleBoundary } from "./schedule_types.ts"

export type SamplingQueryExecutor = <T>(
  request: ProviderQueryRequest<T>,
) => Promise<ProviderQueryResult<T>>

export type SamplingScheduleRunner = (
  boundaries: readonly SampleBoundary[],
  dependencies: SchedulerDependencies,
) => Promise<SchedulerResult>

export type SamplingPhaseDependencies = {
  randomBytes: (size: number) => Uint8Array
  query: SamplingQueryExecutor
  initializeReceipt: (root: string, runId: string) => Promise<ReceiptWriterState>
  appendReceipt: (
    state: ReceiptWriterState,
    input: ReceiptInput,
  ) => Promise<ReceiptRecord>
  verifyReceipt: (path: string) => Promise<ReceiptVerification>
  schedule: SamplingScheduleRunner
  clock: SchedulerClock
  timer: SchedulerTimer
}

export type SamplingPhaseInput = {
  runtime: ReleasedRuntime
  repositoryRoot: string
  receiptRoot: string
  signal?: AbortSignal
  deferLockRelease?: boolean
}
