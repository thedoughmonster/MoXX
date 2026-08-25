import type { RecoveryPreflightFailure } from "./recovery_preflight_failure_types.ts"

export class RecoveryPreflightFailureError extends Error {
  readonly failure: RecoveryPreflightFailure

  constructor(failure: RecoveryPreflightFailure) {
    super(`Recovery preflight failed: ${failure.reasonCategory}`)
    this.name = "RecoveryPreflightFailureError"
    this.failure = failure
  }
}
