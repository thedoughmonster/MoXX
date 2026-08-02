import type { DeadmanPhaseHandoff,
  DeadmanPhaseResult } from "./deadman_phase_types.ts"
import type { FinalArtifactInput,
  FinalArtifactReceipt, FinalArtifactStatus,
  FinalArtifactWriteOptions } from "./final_artifact_types.ts"
import type { ReceiptInput, ReceiptRecord,
  ReceiptVerification, ReceiptWriterState } from "./receipt_types.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"
import type { SamplingPhaseResult } from "./sampling_phase_types.ts"

export type SignalSource = {
  on: (event: "SIGINT" | "SIGTERM", listener: () => void) => unknown
  off: (event: "SIGINT" | "SIGTERM", listener: () => void) => unknown
}

export type InstalledSignalHandlers = {
  signal: AbortSignal
  remove: () => void
  signalCount: () => number
}

export type CanaryTerminalContext = {
  artifactInput: FinalArtifactInput
  runtime: ReleasedRuntime
  retainLock: boolean
}

export type CanaryProgramDependencies = {
  prepareRuntime: (args: string[], repositoryRoot: string) => Promise<ReleasedRuntime>
  prepareReceiptRoot: () => Promise<string>
  runSampling: (
    runtime: ReleasedRuntime,
    repositoryRoot: string,
    receiptRoot: string,
    signal: AbortSignal,
  ) => Promise<SamplingPhaseResult>
  runDeadman: (
    handoff: DeadmanPhaseHandoff,
    signal: AbortSignal,
  ) => Promise<DeadmanPhaseResult>
  appendReceipt: (
    state: ReceiptWriterState,
    input: ReceiptInput,
  ) => Promise<ReceiptRecord>
  verifyReceipt: (path: string) => Promise<ReceiptVerification>
  writeFinalArtifact: (
    input: FinalArtifactInput,
    options?: FinalArtifactWriteOptions,
  ) => Promise<FinalArtifactReceipt>
  invalidateFinalArtifact: (
    published: FinalArtifactReceipt,
  ) => Promise<FinalArtifactReceipt>
  installSignalHandlers: () => InstalledSignalHandlers
  nowUtcMs: () => number
}

export type ProgramTerminalEnvelope = {
  status: FinalArtifactStatus
  runId: string
  finalReceiptPath: string
  finalReceiptSha256: string
}

export type CanaryProgramResult = {
  exitCode: 0 | 20 | 30 | 40
  stderrCode: "MANUAL_RECONCILIATION_REQUIRED" |
    "PRE_GUARD_FAILURE" | "RECOVERED_BUT_UNSUCCESSFUL" | null
  envelope: ProgramTerminalEnvelope | null
}

export type ProgramIo = {
  stdout: (value: string) => void
  stderr: (value: string) => void
}
