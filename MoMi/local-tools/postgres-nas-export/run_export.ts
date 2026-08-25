import { lstat, mkdir } from "node:fs/promises"
import { join } from "node:path"

import { acquireLock } from "./acquire_lock.ts"
import { applyRetention } from "./apply_retention.ts"
import { assertSafeTarget } from "./assert_safe_target.ts"
import { assertStateMatches } from "./assert_state_matches.ts"
import { confirmExecution } from "./confirm_execution.ts"
import { CONTROL_DIRECTORY, REPOSITORY_ROOT } from "./constants.ts"
import { createRunId } from "./create_run_id.ts"
import { createRunState } from "./create_run_state.ts"
import { loadRunState } from "./load_run_state.ts"
import { loadWorkspace } from "./load_workspace.ts"
import { parseCli } from "./parse_cli.ts"
import { prepareDirectories } from "./prepare_directories.ts"
import { publishArchive } from "./publish_archive.ts"
import { releaseLock } from "./release_lock.ts"
import { resolvePgTools } from "./resolve_pg_tools.ts"
import { saveRunState } from "./save_run_state.ts"
import { scanManualSource } from "./scan_manual_source.ts"
import { stageExportArtifacts } from "./stage_export_artifacts.ts"
import { validateRequest } from "./validate_request.ts"
import { validateStagedExport } from "./validate_staged_export.ts"
import { validateUncTarget } from "./validate_unc_target.ts"
import { verifyManualSource } from "./verify_manual_source.ts"
import { verifyPublishedExport } from "./verify_published_export.ts"
import type { RunState } from "./types.ts"

export async function runExport(args: string[]): Promise<void> {
  const options = parseCli("export", args)
  const workspace = await loadWorkspace()
  validateRequest(options, workspace)
  validateUncTarget(options.target, REPOSITORY_ROOT)
  await assertSafeTarget(options.target, REPOSITORY_ROOT)
  const manualPreview = options.manualExportDir ?
    await scanManualSource(options.manualExportDir, REPOSITORY_ROOT) : []
  const tools = await resolvePgTools()
  const runId = options.resumeRunId ?? createRunId()
  const phrase = `EXPORT ${runId} ${options.environment}/${options.projectRef} TO ${options.target}` +
    (options.manualExportDir ? " WITH MANUAL EXPORTS" : "")
  console.log(`${options.dryRun ? "DRY RUN" : "EXECUTE"}: PostgreSQL 17 archive export`)
  console.log(options.dryRun && !options.resumeRunId ?
    "Run: generated when execution begins" : `Run: ${runId}`)
  console.log(`Schemas: ${workspace.database_schemas.join(", ")}`)
  console.log(`Manual files: ${manualPreview.length}`)
  if (options.dryRun) {
    console.log("No files were written. Re-run with --execute to receive the exact prompt.")
    return
  }
  await confirmExecution(phrase)
  const lock = await acquireLock(options.target, runId)
  let state: RunState | undefined
  let stateMatched = false
  try {
    await prepareDirectories(options.target)
    state = options.resumeRunId ? await loadRunState(options.target, runId) :
      createRunState(options, workspace.database_schemas, runId)
    assertStateMatches(state, options, workspace.database_schemas)
    stateMatched = true
    if (options.resumeRunId) state.attempt_count += 1
    state.status = "running"
    delete state.failure_phase
    delete state.failure_at
    await saveRunState(options.target, state)
    const staging = join(options.target, CONTROL_DIRECTORY, "staging", runId)
    await mkdir(staging, { recursive: true })
    const stagingInfo = await lstat(staging)
    if (!stagingInfo.isDirectory() || stagingInfo.isSymbolicLink()) {
      throw new Error("Run staging directory is unsafe")
    }
    if (!state.completed_phases.includes("dumped")) {
      await stageExportArtifacts(tools, state, staging, options.manualExportDir)
      state.completed_phases.push("dumped")
      await saveRunState(options.target, state)
    } else if (options.manualExportDir && !state.completed_phases.includes("published")) {
      await verifyManualSource(
        options.manualExportDir, REPOSITORY_ROOT, state.manual_files ?? [],
      )
    }
    if (!state.completed_phases.includes("validated")) {
      await validateStagedExport(tools.pgRestore, staging)
      state.completed_phases.push("validated")
      await saveRunState(options.target, state)
    }
    if (!state.completed_phases.includes("published")) {
      await publishArchive(options.target, state, staging)
      await verifyPublishedExport(
        options.target, state.archive_id, state.environment, state.project_ref, tools.pgRestore,
      )
      state.completed_phases.push("published")
      await saveRunState(options.target, state)
    } else {
      await verifyPublishedExport(
        options.target, state.archive_id, state.environment, state.project_ref, tools.pgRestore,
      )
    }
    if (!state.completed_phases.includes("retained")) {
      const removed = await applyRetention(options.target, state.archive_id)
      state.completed_phases.push("retained")
      await saveRunState(options.target, state)
      console.log(`Retention removed ${removed.length} superseded archive(s).`)
    }
    state.status = "completed"
    await saveRunState(options.target, state)
    console.log(`Export complete. Archive: ${state.archive_id}`)
  } catch (error) {
    if (state && stateMatched) {
      const phases = ["dumped", "validated", "published", "retained", "complete"]
      state.status = "failed"
      state.failure_phase = phases[state.completed_phases.length]
      state.failure_at = new Date().toISOString()
      try { await saveRunState(options.target, state) } catch { /* Preserve the operation error. */ }
    }
    throw error
  } finally {
    await releaseLock(lock)
  }
}
