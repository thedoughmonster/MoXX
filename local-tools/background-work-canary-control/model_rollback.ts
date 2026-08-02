import type {
  RecoveryControlModelResult,
  RollbackModelInput,
} from "./recovery_control_types.ts"

export function modelRollback(input: RollbackModelInput): RecoveryControlModelResult {
  const actions = ["spawn_fresh_bounded_cli_child"]
  if (!input.childFresh) return { outcome: "child_rejected", actions: [
    ...actions, "provider_deadman_fallback_preserved",
  ] }
  actions.push("begin", "try_advisory_lock")
  if (!input.lockAcquired) return { outcome: "lock_unavailable", actions: [
    ...actions, "rollback", "provider_deadman_fallback_preserved",
  ] }
  actions.push("validate_exact_targets", "validate_guard")
  if (!input.targetIdentitiesMatch || input.guardState === "drift") {
    return { outcome: "identity_drift", actions: [
      ...actions, "rollback", "provider_deadman_fallback_preserved",
    ] }
  }
  actions.push("deactivate:3", "deactivate:2", "deactivate:11", "deactivate:4",
    "readback_targets")
  if (!input.targetReadbackInactive) return { outcome: "target_readback_failed", actions: [
    ...actions, "rollback", "provider_deadman_fallback_preserved",
  ] }
  if (input.guardState === "exact_active") actions.push("deactivate:guard")
  actions.push("readback_guard")
  if (!input.guardReadbackSafe) return { outcome: "guard_readback_failed", actions: [
    ...actions, "rollback", "provider_deadman_fallback_preserved",
  ] }
  actions.push("commit")
  const outcome = input.guardState === "absent"
    ? "rollback_succeeded_guard_absent"
    : input.guardState === "exact_inactive"
      ? "rollback_succeeded_guard_already_inactive"
      : "rollback_succeeded_guard_deactivated"
  return { outcome, actions }
}
