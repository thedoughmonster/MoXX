import type {
  ReceiptEventType,
  ReceiptMetricGroup,
  ReceiptMetricKey,
} from "./receipt_types.ts"

export const RECEIPT_FILE = "receipt.ndjson"
export const RECEIPT_GENESIS =
  "0000000000000000000000000000000000000000000000000000000000000000"
export const MAX_METRIC_ENTRIES = 64
export const MAX_METRICS_BYTES = 16 * 1024

export const RECEIPT_EVENT_TYPES: readonly ReceiptEventType[] = [
  "activation_completed", "canary_observation", "cleanup_completed", "deadman_reconciled",
  "failure", "fast_sample", "guard_heartbeat", "resource_sample",
  "rollback_completed", "rollback_started",
  "run_completed", "run_started", "stop_requested",
  "work_baseline",
]

export const RECEIPT_METRIC_GROUPS: readonly ReceiptMetricGroup[] = [
  "guard", "queues", "resources", "target", "timing",
]

export const RECEIPT_NUMBER_KEYS: readonly ReceiptMetricKey[] = [
  "active_after_mask", "active_before_mask", "active_cron_executions", "child_exit_code",
  "completed_count", "count",
  "cohort_lineage_edge_count", "cohort_membership_count", "cohort_root_count",
  "cron_history_bytes", "database_bytes",
  "deadlocks", "delivery_ready", "delivery_root_count", "duration_ms", "guard_failures", "job_id",
  "exact_identity_mask", "inactive_after_mask", "missed_samples",
  "numbackends", "observed_outer_unexpected_keys", "observed_row_count",
  "observed_sample_unexpected_keys", "oldest_age_seconds", "overlap_count", "queue_length",
  "queue_mapping_count", "queue_ready", "registry_count", "routing_catalog_count",
  "routing_ready", "routing_root_count",
  "target_run_count", "target_run_failures",
  "terminal_failure_count", "terminal_guard_run_id", "terminal_run_count",
  "toast_ready", "toast_root_count", "waiting_locks", "wal_bytes",
  "wal_directory_bytes", "zero_samples",
]

export const RECEIPT_BOOLEAN_KEYS: readonly ReceiptMetricKey[] = [
  "active", "guard_active", "rollback_invoked",
]

export const RECEIPT_STRING_KEYS: readonly ReceiptMetricKey[] = [
  "command_md5", "error_class", "expiry_utc", "generation_sha256",
  "guard_run_status", "job_name", "original_command_md5",
  "original_command_sha256", "observed_outer_keys", "observed_sample_keys",
  "observed_top_level_type", "observed_value_types", "parse_subreason",
  "project_ref", "provider_code", "sample_kind", "schedule", "status",
  "cohort_boundary_sha256", "cohort_lineage_edge_sha256",
  "cohort_membership_sha256", "cohort_root_sha256", "delivery_root_sha256",
  "queue_mapping_sha256", "registry_sha256", "routing_catalog_sha256",
  "routing_root_sha256", "schedule_due_sha256", "toast_root_sha256", "toast_sha256",
  "terminal_command_md5", "terminal_command_sha256", "terminal_guard_start_utc",
]
