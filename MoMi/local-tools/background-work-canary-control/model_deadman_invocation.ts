import type {
  DeadmanModelInput,
  DeadmanModelResult,
} from "./deadman_command_types.ts"

export function modelDeadmanInvocation(input: DeadmanModelInput): DeadmanModelResult {
  const actions = ["advisory_lock"]
  if (input.guardIdentityCount !== 1) {
    return { outcome: "guard_identity_error", actions }
  }
  if (input.invocationGeneration !== input.currentGeneration) {
    return { outcome: "stale_generation", actions }
  }
  if (input.nowUtcMs < input.expiryUtcMs) {
    return { outcome: "before_expiry", actions }
  }
  if ((input.exactIdentityMask & 2) === 2) actions.push("deactivate:3")
  if ((input.exactIdentityMask & 1) === 1) actions.push("deactivate:2")
  if ((input.exactIdentityMask & 8) === 8) actions.push("deactivate:11")
  actions.push("persist:terminal_evidence", "deactivate:guard")
  const safe = input.exactIdentityMask === 15 && input.activeBeforeMask === 0 &&
    input.inactiveAfterMask === 15
  return {
    outcome: safe ? "deactivated" : "deactivated_manual_evidence",
    actions,
  }
}
