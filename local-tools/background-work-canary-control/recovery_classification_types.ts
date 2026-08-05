import type { InstalledSignalHandlers } from "./program_types.ts"
import type { ReceiptInput, ReceiptVerification } from "./receipt_types.ts"
import type { RecoveryPreflightFailure } from "./recovery_preflight_failure_types.ts"
import type { RecoverySnapshot, RecoveryState } from "./recovery_types.ts"
import type { BoundedChildRunner, ReleasedRuntime } from "./runtime_adapter_types.ts"

export type RecoveryClassificationTiming = {
  startedAtUtcMs: number
  endedAtUtcMs: number
  durationMs: number
}

export type RecoveryClassificationArtifact = { path: string; sha256: string }

export type RecoveryClassificationResult = {
  exitCode: 0 | 20 | 40
  stderrCode: "PRE_GUARD_FAILURE" | "MANUAL_RECONCILIATION_REQUIRED" | null
  envelope: null | {
    status: "accepted_classification"
    runId: string
    finalReceiptPath: string
    finalReceiptSha256: string
  }
}

export type RecoveryClassificationDependencies = {
  prepareRuntime: (args: string[], repositoryRoot: string) => Promise<ReleasedRuntime>
  prepareState: (
    runtime: ReleasedRuntime, repositoryRoot: string, signal: AbortSignal,
  ) => Promise<RecoveryState>
  runPreflight: (state: RecoveryState) => Promise<RecoverySnapshot>
  collectReleaseTree: (
    repositoryRoot: string, releaseSha: string, runtime: ReleasedRuntime,
    runner: BoundedChildRunner, environment: NodeJS.ProcessEnv,
  ) => Promise<string>
  runChild: BoundedChildRunner
  environment: NodeJS.ProcessEnv
  appendReceipt: (state: RecoveryState["receipt"], input: ReceiptInput) => Promise<unknown>
  recordFailure: (
    state: RecoveryState, failure: RecoveryPreflightFailure,
  ) => Promise<RecoveryClassificationArtifact>
  verifyReceipt: (path: string) => Promise<ReceiptVerification>
  writeArtifact: (
    state: RecoveryState, snapshot: RecoverySnapshot,
    timing: RecoveryClassificationTiming, receipt: ReceiptVerification,
  ) => Promise<RecoveryClassificationArtifact>
  closeProvider: (runtime: ReleasedRuntime) => Promise<void>
  releaseLock: (runtime: ReleasedRuntime) => Promise<void>
  invalidateArtifact: (artifact: RecoveryClassificationArtifact) => Promise<void>
  closeControls: (runtime: ReleasedRuntime) => Promise<void>
  installSignalHandlers: () => InstalledSignalHandlers
  nowUtcMs: () => number
}
