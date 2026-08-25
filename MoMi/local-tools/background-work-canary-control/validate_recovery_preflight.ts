import { evaluateRecoveryPreflightInvariants } from "./evaluate_recovery_preflight_invariants.ts"
import { RecoveryPreflightInvariantError } from "./recovery_preflight_invariant_error.ts"
import type { RecoverySnapshot } from "./recovery_types.ts"

export function validateRecoveryPreflight(
  sample: RecoverySnapshot, expectedGuardIdentityCount = 0,
): RecoverySnapshot {
  const groups = evaluateRecoveryPreflightInvariants(sample, expectedGuardIdentityCount)
  const reason = (["work", "control", "cohort", "routes", "safety"] as const)
    .find((group) => groups[group])
  if (reason) throw new RecoveryPreflightInvariantError(reason, groups)
  return sample
}
