import type { SamplingPhaseDependencies,
  SamplingPhaseInput } from "./sampling_phase_dependencies.ts"
import type { InternalProviderSqlKind,
  ProviderQueryFailureReason } from "./runtime_adapter_types.ts"

export type SamplingHarnessOptions = {
  thresholdAt?: number
  providerFailure?: {
    kind: InternalProviderSqlKind
    combinedIndex?: number
    reason: ProviderQueryFailureReason
  }
  receiptFailureAt?: number
  cancelAt?: number
  bootstrapSchemaDrift?: boolean
  lockLossAt?: "identity" | "preflight_resource" | "preflight_fast" |
    "run_started_receipt" | "bootstrap" | "bootstrap_receipt" |
    "sampling_provider" | "sampling_receipt" | "receipt_verification"
  preexistingGuard?: boolean
}

export type SamplingHarnessTelemetry = {
  nowUtcMs: number
  randomCalls: number
  combinedCalls: number
  appendCalls: number
  releases: number
  providerKinds: InternalProviderSqlKind[]
  observedBoundaries: number[]
}

export type SamplingHarness = {
  input: SamplingPhaseInput
  dependencies: SamplingPhaseDependencies
  telemetry: SamplingHarnessTelemetry
  loseLock: () => void
  cleanup: () => Promise<void>
}
