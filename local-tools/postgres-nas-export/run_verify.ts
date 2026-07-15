import { acquireLock } from "./acquire_lock.ts"
import { assertSafeTarget } from "./assert_safe_target.ts"
import { confirmExecution } from "./confirm_execution.ts"
import { REPOSITORY_ROOT } from "./constants.ts"
import { createRunId } from "./create_run_id.ts"
import { loadWorkspace } from "./load_workspace.ts"
import { parseCli } from "./parse_cli.ts"
import { releaseLock } from "./release_lock.ts"
import { resolvePgTools } from "./resolve_pg_tools.ts"
import { validateRequest } from "./validate_request.ts"
import { validateUncTarget } from "./validate_unc_target.ts"
import { verifyPublishedExport } from "./verify_published_export.ts"

export async function runVerify(args: string[]): Promise<void> {
  const options = parseCli("verify", args)
  const workspace = await loadWorkspace()
  validateRequest(options, workspace)
  validateUncTarget(options.target, REPOSITORY_ROOT)
  await assertSafeTarget(options.target, REPOSITORY_ROOT)
  const tools = await resolvePgTools()
  const runId = createRunId()
  const phrase = `VERIFY ${options.archiveId} ${options.environment}/${options.projectRef} FROM ${options.target}`
  console.log(`${options.dryRun ? "DRY RUN" : "EXECUTE"}: SHA-256 and pg_restore list verification`)
  console.log(`Archive: ${options.archiveId}`)
  if (options.dryRun) {
    console.log("No archive bytes were read. Re-run with --execute to receive the exact prompt.")
    return
  }
  await confirmExecution(phrase)
  const lock = await acquireLock(options.target, runId)
  try {
    const verified = await verifyPublishedExport(
      options.target,
      options.archiveId as string,
      options.environment,
      options.projectRef,
      tools.pgRestore,
    )
    console.log(`Verification passed for ${3 + verified.manifest.manual_files.length} file(s).`)
  } finally {
    await releaseLock(lock)
  }
}
