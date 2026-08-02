import type {
  GuardHeartbeatModelInput,
  GuardHeartbeatModelResult,
} from "./guard_heartbeat_types.ts"

export function modelGuardHeartbeat(input: GuardHeartbeatModelInput): GuardHeartbeatModelResult {
  const actions = ["begin", "try_advisory_lock"]
  if (!input.lockAcquired) {
    return { outcome: "lock_unavailable", actions: [...actions, "rollback"] }
  }
  actions.push("lock_guard", "validate_current_guard")
  if (input.guardIdentityCount !== 1 || !input.guardIdentityMatches) {
    return { outcome: "guard_identity_error", actions: [...actions, "rollback"] }
  }
  if (!input.guardActive) {
    return { outcome: "guard_inactive", actions: [...actions, "rollback"] }
  }
  if (!input.currentCommandMatches) {
    return { outcome: "current_command_mismatch", actions: [...actions, "rollback"] }
  }
  actions.push("lock_targets", "validate_targets")
  if (!input.targetIdentityMatches) {
    return { outcome: "target_identity_drift", actions: [...actions, "rollback"] }
  }
  if (!input.targetsInactive) {
    return { outcome: "target_active", actions: [...actions, "rollback"] }
  }
  if (input.targetExecutions !== 0) {
    return { outcome: "target_execution_present", actions: [...actions, "rollback"] }
  }
  if (input.placeholderCount !== 1) {
    return { outcome: "placeholder_mismatch", actions: [...actions, "rollback"] }
  }
  actions.push("capture_db_clock")
  if (!input.currentExpiryValid) {
    return { outcome: "current_expired", actions: [...actions, "rollback"] }
  }
  actions.push("materialize_next", "alter_guard")
  if (!input.alterSucceeded) {
    return { outcome: "alter_failed", actions: [...actions, "rollback"] }
  }
  actions.push("validate_readback")
  if (!input.readbackMatches || !input.readbackHashesMatch) {
    return { outcome: "readback_mismatch", actions: [...actions, "rollback"] }
  }
  actions.push("emit_sanitized_receipt", "commit")
  return { outcome: "success", actions }
}
