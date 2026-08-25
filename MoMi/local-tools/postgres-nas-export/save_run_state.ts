import { randomUUID } from "node:crypto"
import { lstat, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { CONTROL_DIRECTORY } from "./constants.ts"
import type { RunState } from "./types.ts"

export async function saveRunState(target: string, state: RunState): Promise<void> {
  const directory = join(target, CONTROL_DIRECTORY, "runs")
  const destination = join(directory, `${state.run_id}.json`)
  try {
    const existing = await lstat(destination)
    if (existing.isSymbolicLink()) throw new Error("Run state cannot be a symlink")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  state.updated_at = new Date().toISOString()
  const persisted: RunState = {
    schema_version: 1,
    run_id: state.run_id,
    operation: state.operation,
    environment: state.environment,
    project_ref: state.project_ref,
    archive_id: state.archive_id,
    schemas: [...state.schemas],
    created_at: state.created_at,
    updated_at: state.updated_at,
    status: state.status,
    attempt_count: state.attempt_count,
    completed_phases: [...state.completed_phases],
    ...(state.operation === "export" ? {
      manual_exports: state.manual_exports,
      manual_files: state.manual_files?.map((file) => ({ ...file })),
    } : {}),
    ...(state.failure_phase ? { failure_phase: state.failure_phase } : {}),
    ...(state.failure_at ? { failure_at: state.failure_at } : {}),
    ...(state.isolated_target ? { isolated_target: state.isolated_target } : {}),
    ...(state.quarter ? { quarter: state.quarter } : {}),
  }
  const temporary = join(directory, `${state.run_id}.${randomUUID()}.next`)
  await writeFile(temporary, `${JSON.stringify(persisted, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  })
  await rename(temporary, destination)
}
