import type { DeadmanReconciliationModelInput,
  DeadmanReconciliationModelOutcome } from "./deadman_reconciliation_types.ts"

export function modelDeadmanReconciliation(
  input: DeadmanReconciliationModelInput,
): DeadmanReconciliationModelOutcome {
  if (!input.targetStateSafe || input.guardIdentityCount > 1) {
    return "manual_reconciliation_required"
  }
  if (input.guardIdentityCount === 0) {
    return input.mode === "ambiguous" && !input.ambiguousHistoryAfterBaseline
      ? "bootstrap_not_committed_or_rolled_back"
      : "manual_reconciliation_required"
  }
  if (input.guardIdentityCount !== 1 || !input.guardIdentityMatches ||
    !input.commandBindingValid || !input.successfulPostExpiryRun ||
    input.failureAfterBaseline || input.ambiguousHistoryAfterBaseline) {
    return "manual_reconciliation_required"
  }
  return "deadman_reconciled"
}
