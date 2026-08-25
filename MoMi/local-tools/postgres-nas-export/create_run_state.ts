import type { CliOptions, RunState } from "./types.ts"

export function createRunState(
  options: CliOptions,
  schemas: string[],
  runId: string,
  now = new Date(),
): RunState {
  if (options.operation === "verify") throw new Error("Verification does not create run state")
  const timestamp = now.toISOString()
  return {
    schema_version: 1,
    run_id: runId,
    operation: options.operation,
    environment: options.environment,
    project_ref: options.projectRef,
    archive_id: options.operation === "export" ? runId : options.archiveId as string,
    schemas: [...schemas],
    created_at: timestamp,
    updated_at: timestamp,
    status: "running",
    attempt_count: 1,
    completed_phases: [],
    ...(options.operation === "export" ? {
      manual_exports: options.manualExportDir !== undefined,
      manual_files: [],
    } : {}),
    ...(options.operation === "restore-drill" ? {
      isolated_target: options.isolatedTarget,
      quarter: options.quarter,
    } : {}),
  }
}
