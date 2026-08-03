export type ReceiptEventType =
  | "activation_completed"
  | "canary_observation"
  | "cleanup_completed"
  | "deadman_reconciled"
  | "failure"
  | "fast_sample"
  | "guard_heartbeat"
  | "resource_sample"
  | "rollback_completed"
  | "rollback_started"
  | "run_completed"
  | "run_started"
  | "stop_requested"
  | "work_baseline"

export type ReceiptMetricKey =
  | "active"
  | "active_after_mask"
  | "active_cron_executions"
  | "active_before_mask"
  | "command_md5"
  | "child_exit_code"
  | "count"
  | "completed_count"
  | "cohort_boundary_sha256"
  | "cohort_lineage_edge_count"
  | "cohort_lineage_edge_sha256"
  | "cohort_membership_count"
  | "cohort_membership_sha256"
  | "cohort_root_count"
  | "cohort_root_sha256"
  | "cron_history_bytes"
  | "database_bytes"
  | "delivery_ready"
  | "delivery_root_count"
  | "delivery_root_sha256"
  | "deadlocks"
  | "duration_ms"
  | "error_class"
  | "generation_sha256"
  | "exact_identity_mask"
  | "guard_active"
  | "guard_failures"
  | "guard_run_status"
  | "job_id"
  | "job_name"
  | "missed_samples"
  | "inactive_after_mask"
  | "numbackends"
  | "oldest_age_seconds"
  | "observed_outer_keys"
  | "observed_outer_unexpected_keys"
  | "observed_row_count"
  | "observed_sample_keys"
  | "observed_sample_unexpected_keys"
  | "observed_top_level_type"
  | "observed_value_types"
  | "overlap_count"
  | "parse_subreason"
  | "project_ref"
  | "provider_code"
  | "queue_length"
  | "queue_mapping_count"
  | "queue_mapping_sha256"
  | "queue_ready"
  | "rollback_invoked"
  | "sample_kind"
  | "schedule"
  | "schedule_due_sha256"
  | "terminal_command_md5"
  | "terminal_command_sha256"
  | "terminal_failure_count"
  | "terminal_guard_run_id"
  | "terminal_guard_start_utc"
  | "terminal_run_count"
  | "original_command_md5"
  | "original_command_sha256"
  | "expiry_utc"
  | "status"
  | "routing_ready"
  | "routing_root_count"
  | "routing_root_sha256"
  | "registry_count"
  | "registry_sha256"
  | "routing_catalog_count"
  | "routing_catalog_sha256"
  | "target_run_count"
  | "target_run_failures"
  | "toast_ready"
  | "toast_root_count"
  | "toast_root_sha256"
  | "toast_sha256"
  | "zero_samples"
  | "waiting_locks"
  | "wal_bytes"
  | "wal_directory_bytes"

export type ReceiptMetricGroup = "guard" | "queues" | "resources" | "target" | "timing"
export type ReceiptScalar = boolean | number | string | null
export type ReceiptMetricObject = Partial<Record<ReceiptMetricKey, ReceiptScalar>>
export type ReceiptMetrics = Partial<Record<ReceiptMetricKey, ReceiptScalar>> &
  Partial<Record<ReceiptMetricGroup, ReceiptMetricObject>>

export type ReceiptInput = {
  event_type: ReceiptEventType
  timestamp_utc: string
  metrics: ReceiptMetrics
}

export type ReceiptRecord = ReceiptInput & {
  sequence: number
  previous_hash: string
  current_hash: string
}

export type ReceiptVerification = {
  count: number
  lastHash: string
  nextSequence: number
  size: number
}

export type ReceiptFileIdentity = {
  dev: number
  ino: number
  size: number
}

export type ReceiptWriterState = ReceiptVerification & ReceiptFileIdentity & {
  path: string
  directory: string
  poisoned: boolean
  writing: boolean
}

export type ReceiptLineWriter = (path: string, line: string) => Promise<void>
