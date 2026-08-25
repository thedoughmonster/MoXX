import { acquireLock } from "./acquire_lock.ts"
import { assertSafeTarget } from "./assert_safe_target.ts"
import { assertStateMatches } from "./assert_state_matches.ts"
import { buildPgEnvironment } from "./build_pg_environment.ts"
import { buildRestoreArgs } from "./build_restore_args.ts"
import { confirmExecution } from "./confirm_execution.ts"
import { REPOSITORY_ROOT } from "./constants.ts"
import { createRunId } from "./create_run_id.ts"
import { createRunState } from "./create_run_state.ts"
import { currentQuarter } from "./current_quarter.ts"
import { loadRunState } from "./load_run_state.ts"
import { loadWorkspace } from "./load_workspace.ts"
import { parseCli } from "./parse_cli.ts"
import { prepareDirectories } from "./prepare_directories.ts"
import { releaseLock } from "./release_lock.ts"
import { resolvePgTools } from "./resolve_pg_tools.ts"
import { runProcess } from "./run_process.ts"
import { saveRunState } from "./save_run_state.ts"
import { validateRequest } from "./validate_request.ts"
import { validateUncTarget } from "./validate_unc_target.ts"
import { verifyPublishedExport } from "./verify_published_export.ts"
import { writeDrillReceipt } from "./write_drill_receipt.ts"
import type { RunState } from "./types.ts"

export async function runRestoreDrill(args: string[]): Promise<void> {
  const options = parseCli("restore-drill", args)
  const workspace = await loadWorkspace()
  validateRequest(options, workspace)
  if (!options.resumeRunId && options.quarter !== currentQuarter()) {
    throw new Error(`A new restore drill must use the current quarter: ${currentQuarter()}`)
  }
  validateUncTarget(options.target, REPOSITORY_ROOT)
  await assertSafeTarget(options.target, REPOSITORY_ROOT)
  const tools = await resolvePgTools()
  const pgEnvironment = buildPgEnvironment("restore", options.isolatedTarget)
  const runId = options.resumeRunId ?? createRunId()
  const phrase = `RESTORE-DRILL ${runId} ${options.archiveId} INTO ${options.isolatedTarget} FOR ${options.quarter}`
  console.log(`${options.dryRun ? "DRY RUN" : "EXECUTE"}: isolated quarterly restore drill`)
  console.log(`Archive: ${options.archiveId}; isolated database: ${options.isolatedTarget}`)
  if (options.dryRun) {
    console.log("No database was changed. Re-run with --execute to receive the exact prompt.")
    return
  }
  await confirmExecution(phrase)
  const lock = await acquireLock(options.target, runId)
  let state: RunState | undefined
  let stateMatched = false
  try {
    await prepareDirectories(options.target)
    const verified = await verifyPublishedExport(
      options.target,
      options.archiveId as string,
      options.environment,
      options.projectRef,
      tools.pgRestore,
    )
    state = options.resumeRunId ? await loadRunState(options.target, runId) :
      createRunState(options, verified.manifest.schemas, runId)
    assertStateMatches(state, options, verified.manifest.schemas)
    stateMatched = true
    if (options.resumeRunId) state.attempt_count += 1
    state.status = "running"
    delete state.failure_phase
    delete state.failure_at
    await saveRunState(options.target, state)
    if (!state.completed_phases.includes("verified")) {
      state.completed_phases.push("verified")
      await saveRunState(options.target, state)
    }
    if (!state.completed_phases.includes("restored")) {
      runProcess(
        tools.pgRestore,
        buildRestoreArgs(verified.dumpPath, options.isolatedTarget as string),
        pgEnvironment,
        "inherit",
      )
      state.completed_phases.push("restored")
      await saveRunState(options.target, state)
    }
    if (!state.completed_phases.includes("recorded")) {
      await writeDrillReceipt(options.target, state, verified.manifest)
      state.completed_phases.push("recorded")
      await saveRunState(options.target, state)
    }
    state.status = "completed"
    await saveRunState(options.target, state)
    console.log(`Restore drill passed. Run: ${runId}`)
  } catch (error) {
    if (state && stateMatched) {
      const phases = ["verified", "restored", "recorded", "complete"]
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
