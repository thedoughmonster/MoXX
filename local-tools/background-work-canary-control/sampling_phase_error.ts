import type { SamplingFailureReason, SamplingFailureStage } from "./sampling_phase_types.ts"
import type { ProviderParseDiagnostic } from "./provider_parse_diagnostic.ts"

export class SamplingPhaseError extends Error {
  readonly stage: SamplingFailureStage
  readonly reason: SamplingFailureReason
  readonly schemaDiagnostic?: ProviderParseDiagnostic

  constructor(stage: SamplingFailureStage, reason: SamplingFailureReason,
    schemaDiagnostic?: ProviderParseDiagnostic) {
    super(`${stage}:${reason}`)
    this.name = "SamplingPhaseError"
    this.stage = stage
    this.reason = reason
    this.schemaDiagnostic = schemaDiagnostic
  }
}
