import type {
  CleanupModelInput,
  RecoveryControlModelResult,
} from "./recovery_control_types.ts"

export function modelCleanup(input: CleanupModelInput): RecoveryControlModelResult {
  const actions = ["spawn_fresh_bounded_cli_child"]
  if (!input.childFresh) return { outcome: "child_rejected", actions }
  actions.push("begin", "try_advisory_lock")
  if (!input.lockAcquired) return { outcome: "lock_unavailable", actions: [...actions, "rollback"] }
  actions.push("validate_targets_inactive", "validate_guard")
  if (!input.targetsInactive) {
    return { outcome: "target_active", actions: [...actions, "rollback"] }
  }
  if (input.guardState === "drift" || input.guardState === "exact_active") {
    return { outcome: input.guardState === "drift" ? "guard_identity_drift" : "guard_active",
      actions: [...actions, "rollback"] }
  }
  if (input.guardState === "absent") {
    return { outcome: "cleanup_succeeded_guard_already_absent",
      actions: [...actions, "readback_guard_absent", "commit"] }
  }
  actions.push("unschedule_exact_guard")
  if (!input.unscheduleSucceeded || !input.guardAbsentReadback) {
    return { outcome: !input.unscheduleSucceeded ? "unschedule_failed" : "readback_failed",
      actions: [...actions, "rollback"] }
  }
  actions.push("readback_guard_absent", "commit")
  return { outcome: "cleanup_succeeded_guard_removed", actions }
}
