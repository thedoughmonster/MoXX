import type { SamplingFailureReason, SamplingFailureStage } from "./sampling_phase_types.ts"

export class SamplingPhaseError extends Error {
  readonly stage: SamplingFailureStage
  readonly reason: SamplingFailureReason

  constructor(stage: SamplingFailureStage, reason: SamplingFailureReason) {
    super(`${stage}:${reason}`)
    this.name = "SamplingPhaseError"
    this.stage = stage
    this.reason = reason
  }
}
