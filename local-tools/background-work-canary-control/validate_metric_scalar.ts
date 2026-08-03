import { DEV_PROJECT_REF } from "./constants.ts"
import {
  RECEIPT_BOOLEAN_KEYS,
  RECEIPT_NUMBER_KEYS,
  RECEIPT_STRING_KEYS,
} from "./receipt_constants.ts"
import type { ReceiptMetricKey, ReceiptScalar } from "./receipt_types.ts"
import { PROVIDER_PARSE_SUBREASONS } from "./provider_parse_diagnostic.ts"
import { PROVIDER_STDERR_CODES } from "./provider_stderr_codes.ts"

const jobNames = new Set([
  "momi-event-routing-wakeup-v1",
  "momi-issue-330-canary-deadman-v1",
  "momi-toast-acquisition-wakeup-v1",
  "momi-warehouse-projection-database-v1",
  "momi-warehouse-projection-wakeup-v1",
])
const statuses = new Set([
  "active", "bootstrap_ambiguity_reconciled", "completed", "failed",
  "classified", "failure_recovered_by_deadman", "guard_absent", "inactive",
  "inactive_dry_run_verified", "manual_reconciliation_required", "passed", "pending",
  "reconciled", "rollback_and_cleanup_read_back", "started", "stopped",
  "stopped_recovered",
])

export function validateMetricScalar(key: ReceiptMetricKey, value: unknown): void {
  if (value === null && key === "oldest_age_seconds") return
  if (RECEIPT_NUMBER_KEYS.includes(key)) {
    if (!Number.isSafeInteger(value) || (value as number) < 0) {
      throw new Error(`Receipt metric ${key} must be a non-negative safe integer`)
    }
    if (key === "child_exit_code" && ((value as number) < 1 || (value as number) > 255)) {
      throw new Error("Receipt child_exit_code is invalid")
    }
    return
  }
  if (RECEIPT_BOOLEAN_KEYS.includes(key)) {
    if (typeof value !== "boolean") throw new Error(`Receipt metric ${key} must be boolean`)
    return
  }
  if (!RECEIPT_STRING_KEYS.includes(key) || typeof value !== "string") {
    throw new Error(`Receipt metric ${key} has an unsafe value`)
  }
  if (key === "project_ref" && value !== DEV_PROJECT_REF) {
    throw new Error("Receipt project_ref must match development")
  }
  if (key === "command_md5" && !/^[a-f0-9]{32}$/.test(value)) {
    throw new Error("Receipt command_md5 is invalid")
  }
  if (["generation_sha256", "registry_sha256", "routing_catalog_sha256",
    "schedule_due_sha256", "toast_sha256"].includes(key) &&
    !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`Receipt ${key} is invalid`)
  }
  if (["original_command_sha256", "terminal_command_sha256"].includes(key) &&
    !/^[a-f0-9]{64}$/.test(value)) throw new Error(`Receipt ${key} is invalid`)
  if (["original_command_md5", "terminal_command_md5"].includes(key) &&
    !/^[a-f0-9]{32}$/.test(value)) throw new Error(`Receipt ${key} is invalid`)
  if (["expiry_utc", "terminal_guard_start_utc"].includes(key) &&
    (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value) ||
      Number.isNaN(Date.parse(value)))) throw new Error(`Receipt ${key} is invalid`)
  if (key === "guard_run_status" && value !== "succeeded") {
    throw new Error("Receipt guard_run_status is invalid")
  }
  if (key === "job_name" && !jobNames.has(value)) throw new Error("Receipt job_name is invalid")
  if (key === "sample_kind" && !["fast", "fast_and_resource", "resource"].includes(value)) {
    throw new Error("Receipt sample_kind is invalid")
  }
  if (key === "schedule" && !["1 second", "3 seconds", "5 seconds"].includes(value)) {
    throw new Error("Receipt schedule is invalid")
  }
  if (key === "status" && !statuses.has(value)) throw new Error("Receipt status is invalid")
  if (key === "error_class" && !/^[a-z][a-z0-9_]{0,63}$/.test(value)) {
    throw new Error("Receipt error_class is invalid")
  }
  if (key === "parse_subreason" &&
    !PROVIDER_PARSE_SUBREASONS.includes(value as never)) {
    throw new Error("Receipt parse_subreason is invalid")
  }
  if (key === "provider_code" && !PROVIDER_STDERR_CODES.includes(value as never)) {
    throw new Error("Receipt provider_code is invalid")
  }
  if (key === "observed_top_level_type" &&
    !["array", "boolean", "null", "number", "object", "string", "undefined"].includes(value)) {
    throw new Error("Receipt observed_top_level_type is invalid")
  }
  if (["observed_outer_keys", "observed_sample_keys"].includes(key) &&
    (value.length > 512 || !/^(none|[A-Za-z][A-Za-z0-9_]*(,[A-Za-z][A-Za-z0-9_]*)*)$/.test(value))) {
    throw new Error(`Receipt ${key} is invalid`)
  }
  if (key === "observed_value_types" &&
    (value.length > 1024 || !/^(none|[A-Za-z][A-Za-z0-9_]*:(array|boolean|null|number|object|string|undefined)(,[A-Za-z][A-Za-z0-9_]*:(array|boolean|null|number|object|string|undefined))*)$/.test(value))) {
    throw new Error("Receipt observed_value_types is invalid")
  }
}
