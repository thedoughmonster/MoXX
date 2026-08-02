export const FINAL_ARTIFACT_FILE = "final.json"
export const FINAL_ARTIFACT_INVALIDATED_FILE = "final.invalidated.json"
export const FINAL_ARTIFACT_MAX_BYTES = 16 * 1024
export const FINAL_ARTIFACT_STAGING_FILE = "final.staging.json"

export const FINAL_ARTIFACT_STATUSES = [
  "bootstrap_ambiguity_reconciled",
  "failure_recovered_by_deadman",
  "inactive_dry_run_verified",
  "manual_reconciliation_required",
  "pre_guard_failure",
  "sampling_failed_rollback_completed",
] as const
