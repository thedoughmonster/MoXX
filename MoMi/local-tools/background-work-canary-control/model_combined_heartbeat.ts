import type {
  CombinedHeartbeatModelInput,
  CombinedHeartbeatModelResult,
} from "./combined_heartbeat_types.ts"

export function modelCombinedHeartbeat(
  input: CombinedHeartbeatModelInput,
): CombinedHeartbeatModelResult {
  const actions = ["execute_combined_transaction"]
  if (!input.sqlCommitted) return { outcome: "sql_rollback", actions: [...actions, "rollback"] }
  actions.push("heartbeat_committed", "parse_heartbeat", "parse_fast")
  if (!input.parseSucceeded) {
    return { outcome: "heartbeat_committed_parse_failure", actions: [...actions, "rollback_required"] }
  }
  if (!input.coverageValid) {
    return { outcome: "heartbeat_committed_coverage_rollover",
      actions: [...actions, "rollback_required"] }
  }
  if (input.resourceExpected) actions.push("parse_resource")
  if (!input.resourceMatched) {
    return { outcome: "heartbeat_committed_resource_mismatch",
      actions: [...actions, "rollback_required"] }
  }
  actions.push("evaluate_thresholds")
  if (input.thresholdStopCount > 0) {
    return { outcome: "heartbeat_committed_stop_required",
      actions: [...actions, "rollback_required"] }
  }
  actions.push("sample_passed")
  return {
    outcome: input.resourceExpected
      ? "heartbeat_committed_resource_passed"
      : "heartbeat_committed_fast_passed",
    actions,
  }
}
