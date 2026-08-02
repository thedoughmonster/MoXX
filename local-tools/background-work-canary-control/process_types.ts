export type BoundedChildStatus =
  | "cancelled"
  | "exit_failure"
  | "output_limit"
  | "signalled"
  | "success"
  | "timed_out"

export type BoundedChildRequest = {
  executable: string
  arguments: readonly string[]
  environment?: NodeJS.ProcessEnv
  heldExecutable?: SealedHeldExecutable
  signal?: AbortSignal
  timeoutMs?: number
}

export type BoundedChildOutcome = {
  status: BoundedChildStatus
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdoutBytes: number
  stderrBytes: number
  limitedStream: "stderr" | "stdout" | null
}

export type BoundedChildResult = {
  outcome: BoundedChildOutcome
  stdout: Uint8Array
  stderr: Uint8Array
}

export type CanaryControlLock = {
  flockPath: string
  lockPath: string
  holderPid: number
  lossSignal: AbortSignal
  status: () => "held" | "lost" | "released" | "releasing"
  release: () => Promise<void>
  retainUntilExit?: () => void
}

export type CanaryLockProcessOptions = {
  holderScript?: string
  releaseTimeoutMs?: number
}
import type { SealedHeldExecutable } from "./sealed_held_executable.ts"
