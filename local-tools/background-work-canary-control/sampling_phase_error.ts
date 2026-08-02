import type { SamplingFailureReason, SamplingFailureStage } from "./sampling_phase_types.ts"
import type { ProviderParseDiagnostic } from "./provider_parse_diagnostic.ts"
import type { ProviderStderrCode } from "./provider_stderr_codes.ts"

export class SamplingPhaseError extends Error {
  readonly stage: SamplingFailureStage
  readonly reason: SamplingFailureReason
  readonly schemaDiagnostic?: ProviderParseDiagnostic
  readonly childExitCode?: number
  readonly providerCode?: ProviderStderrCode

  constructor(stage: SamplingFailureStage, reason: SamplingFailureReason,
    schemaDiagnostic?: ProviderParseDiagnostic, childExitCode?: number,
    providerCode?: ProviderStderrCode) {
    super(`${stage}:${reason}`)
    this.name = "SamplingPhaseError"
    this.stage = stage
    this.reason = reason
    this.schemaDiagnostic = schemaDiagnostic
    this.childExitCode = childExitCode
    this.providerCode = providerCode
  }
}
