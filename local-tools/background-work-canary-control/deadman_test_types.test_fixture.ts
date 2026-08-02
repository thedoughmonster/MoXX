import type { DeadmanPhaseDependencies,
  DeadmanPhaseInput } from "./deadman_phase_types.ts"
import type { InternalProviderSqlKind,
  ProviderQueryFailureReason } from "./runtime_adapter_types.ts"

export type DeadmanHandoffKind = "ambiguous" | "known_failure" | "normal"
export type DeadmanReconciliationFault =
  | "active_guard"
  | "active_before"
  | "active_target"
  | "ambiguous_history"
  | "duplicate_guard"
  | "failed_history"
  | "identity_drift"
  | "late_history"
  | "reassigned_id"
  | "terminal_command_drift"
  | "target_drift"

export type DeadmanHarnessOptions = {
  handoffKind?: DeadmanHandoffKind
  guardPresent?: boolean
  reconciliationFault?: DeadmanReconciliationFault
  providerFailure?: {
    kind: InternalProviderSqlKind
    reason: ProviderQueryFailureReason
  }
  receiptFailureAt?: number
  verifyFailure?: boolean
  launchDelayMs?: number
  cancelBeforeDeadline?: boolean
  finalReadyDecrease?: boolean
  finalResourceGrowth?: boolean
  cleanupActiveRefusal?: boolean
  holderLossAt?: "wait" | "reconciliation" | "cleanup" | "final"
}

export type DeadmanHarnessTelemetry = {
  nowUtcMs: number
  monotonicMs: number
  providerKinds: InternalProviderSqlKind[]
  receiptAppends: number
  waitTargets: number[]
  releasesAtStart: number
}

export type DeadmanHarness = {
  input: DeadmanPhaseInput
  dependencies: DeadmanPhaseDependencies
  telemetry: DeadmanHarnessTelemetry
  sourceReleases: () => number
  cleanup: () => Promise<void>
}
