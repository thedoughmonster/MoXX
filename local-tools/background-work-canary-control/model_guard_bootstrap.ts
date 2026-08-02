import {
  MAX_ACTIVE_CRON_EXECUTIONS,
  MAX_PREACTIVATION_OTHER_CRON,
} from "./sample_constants.ts"
import type {
  GuardBootstrapModelInput,
  GuardBootstrapModelResult,
} from "./guard_bootstrap_types.ts"

export function modelGuardBootstrap(input: GuardBootstrapModelInput): GuardBootstrapModelResult {
  const actions = ["begin", "try_advisory_lock"]
  if (!input.lockAcquired) {
    return { outcome: "lock_unavailable", actions: [...actions, "rollback"] }
  }
  actions.push("read_targets", "validate_targets")
  if (!input.targetIdentityMatches) {
    return { outcome: "target_identity_drift", actions: [...actions, "rollback"] }
  }
  if (!input.targetsInactive) {
    return { outcome: "target_active", actions: [...actions, "rollback"] }
  }
  if (input.guardIdentityCount !== 0) {
    return { outcome: "guard_present", actions: [...actions, "rollback"] }
  }
  if (input.targetExecutions !== 0) {
    return { outcome: "target_execution_present", actions: [...actions, "rollback"] }
  }
  actions.push("validate_concurrency")
  if (input.activeCronExecutions > MAX_ACTIVE_CRON_EXECUTIONS) {
    return { outcome: "active_cron_limit", actions: [...actions, "rollback"] }
  }
  if (input.otherCronExecutions > MAX_PREACTIVATION_OTHER_CRON) {
    return { outcome: "other_cron_limit", actions: [...actions, "rollback"] }
  }
  if (input.placeholderCount !== 1) {
    return { outcome: "placeholder_mismatch", actions: [...actions, "rollback"] }
  }
  actions.push("capture_db_clock", "materialize_expiry", "schedule_guard")
  if (input.scheduledJobId < 1) {
    return { outcome: "schedule_failed", actions: [...actions, "rollback"] }
  }
  actions.push("validate_readback")
  if (!input.readbackMatches || !input.readbackHashesMatch) {
    return { outcome: "readback_mismatch", actions: [...actions, "rollback"] }
  }
  actions.push("emit_sanitized_receipt", "commit")
  return { outcome: "success", actions }
}
