import { lstat, readFile } from "node:fs/promises"
import { join } from "node:path"

import { CONTROL_DIRECTORY, PROJECT_REF_PATTERN, RUN_ID_PATTERN, SCHEMA_PATTERN } from
  "./constants.ts"
import type { RunPhase, RunState } from "./types.ts"
import { validateManualRecords } from "./validate_manual_records.ts"

export async function loadRunState(target: string, runId: string): Promise<RunState> {
  const path = join(target, CONTROL_DIRECTORY, "runs", `${runId}.json`)
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Run state path is unsafe")
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"))
  if (!parsed || typeof parsed !== "object") throw new Error("Run state is invalid")
  const value = parsed as Partial<RunState>
  const common = [
    "schema_version", "run_id", "operation", "environment", "project_ref",
    "archive_id", "schemas", "created_at", "updated_at", "completed_phases",
    "status", "attempt_count", "failure_phase", "failure_at",
  ]
  const allowed = value.operation === "restore-drill" ?
    [...common, "isolated_target", "quarter"] :
    [...common, "manual_exports", "manual_files"]
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error("Run state contains unsanitized or unknown fields")
  }
  if (value.schema_version !== 1 || value.run_id !== runId || !RUN_ID_PATTERN.test(runId) ||
    (value.operation !== "export" && value.operation !== "restore-drill") ||
    (value.environment !== "dev" && value.environment !== "prod") ||
    typeof value.project_ref !== "string" || !PROJECT_REF_PATTERN.test(value.project_ref) ||
    typeof value.archive_id !== "string" || !RUN_ID_PATTERN.test(value.archive_id) ||
    (value.status !== "running" && value.status !== "completed" && value.status !== "failed") ||
    !Number.isSafeInteger(value.attempt_count) || (value.attempt_count ?? 0) < 1) {
    throw new Error("Run state identity is invalid")
  }
  if (!Array.isArray(value.schemas) || value.schemas.length === 0 ||
    value.schemas.some((schema) => typeof schema !== "string" || !SCHEMA_PATTERN.test(schema)) ||
    !Array.isArray(value.completed_phases)) {
    throw new Error("Run state schemas or phases are invalid")
  }
  for (const timestamp of [value.created_at, value.updated_at]) {
    if (typeof timestamp !== "string" || new Date(timestamp).toISOString() !== timestamp) {
      throw new Error("Run state timestamps are invalid")
    }
  }
  if (value.status === "failed") {
    if (typeof value.failure_phase !== "string" || typeof value.failure_at !== "string" ||
      !new Set(["dumped", "validated", "published", "retained", "verified", "restored",
        "recorded", "complete"]).has(value.failure_phase) ||
      new Date(value.failure_at).toISOString() !== value.failure_at) {
      throw new Error("Failed run state is missing sanitized failure metadata")
    }
  } else if (value.failure_phase !== undefined || value.failure_at !== undefined) {
    throw new Error("Non-failed run state contains stale failure metadata")
  }
  const phases: RunPhase[] = value.operation === "export" ?
    ["dumped", "validated", "published", "retained"] :
    ["verified", "restored", "recorded"]
  if (value.completed_phases.some((phase, index) => phase !== phases[index])) {
    throw new Error("Run state phases are not a valid completed prefix")
  }
  if (value.operation === "restore-drill" &&
    (typeof value.isolated_target !== "string" || typeof value.quarter !== "string")) {
    throw new Error("Restore run state is incomplete")
  }
  if (value.operation === "export") {
    const manualFiles = validateManualRecords(value.manual_files)
    if (typeof value.manual_exports !== "boolean" ||
      (!value.manual_exports && manualFiles.length > 0)) {
      throw new Error("Export run state has invalid manual file metadata")
    }
  }
  return value as RunState
}
