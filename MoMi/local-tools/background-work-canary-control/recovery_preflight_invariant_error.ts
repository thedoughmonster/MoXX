import type { RecoveryPreflightInvariantGroups,
  RecoveryPreflightReasonCategory } from "./recovery_preflight_failure_types.ts"

export class RecoveryPreflightInvariantError extends Error {
  readonly reasonCategory: RecoveryPreflightReasonCategory
  readonly groups: RecoveryPreflightInvariantGroups

  constructor(reasonCategory: RecoveryPreflightReasonCategory,
    groups: RecoveryPreflightInvariantGroups) {
    super(`Recovery preflight rejected ${reasonCategory}`)
    this.name = "RecoveryPreflightInvariantError"
    this.reasonCategory = reasonCategory
    this.groups = groups
  }
}
