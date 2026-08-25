import type { FastSample } from "./sample_types.ts"
import type { DeadmanTerminalEvidence } from "./deadman_terminal_types.ts"
import type { WorkBaseline } from "./work_baseline_types.ts"

export type DeadmanReconciliationMode = "ambiguous" | "known"

export type DeadmanReconciliationContext = {
  mode: DeadmanReconciliationMode
  runId: string
  generationSha256: string
  guardJobId: number | null
  startCronRunId: number
  workBaseline: WorkBaseline
}

export type DeadmanReconciliationResult = {
  status:
    | "bootstrap_not_committed_or_rolled_back"
    | "deadman_reconciled"
  observedAtUtcMs: number
  guardJobId: number | null
  expiryUtc: string | null
  terminalEvidence: DeadmanTerminalEvidence | null
  fast: FastSample
}

export type DeadmanReconciliationModelInput = {
  mode: DeadmanReconciliationMode
  guardIdentityCount: number
  guardIdentityMatches: boolean
  targetStateSafe: boolean
  commandBindingValid: boolean
  successfulPostExpiryRun: boolean
  failureAfterBaseline: boolean
  ambiguousHistoryAfterBaseline: boolean
}

export type DeadmanReconciliationModelOutcome =
  | "bootstrap_not_committed_or_rolled_back"
  | "deadman_reconciled"
  | "manual_reconciliation_required"
