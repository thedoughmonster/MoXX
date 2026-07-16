import { buildCliEnvironment } from "./build_cli_environment.ts"
import { buildPgEnvironment } from "./build_pg_environment.ts"
import { buildPlanFiles } from "./build_plan_files.ts"
import { CONFIRM_PHRASE } from "./constants.ts"
import { confirmExecution } from "./confirm_execution.ts"
import { executePlan } from "./execute_plan.ts"
import { loadPackage } from "./load_package.ts"
import { parseCli } from "./parse_cli.ts"
import { prepareCliBackend } from "./prepare_cli_backend.ts"
import { validateCli } from "./validate_cli.ts"
import type { ExecutionBackend } from "./types.ts"
import type { PackageTrust } from "./types.ts"
import { PINNED_PACKAGE_TRUST } from "./constants.ts"
import { verifyPackage } from "./verify_package.ts"
import { writePlan } from "./write_plan.ts"

export async function run(
  args: string[],
  trust: PackageTrust = PINNED_PACKAGE_TRUST,
): Promise<void> {
  const options = parseCli(args)
  validateCli(options)
  const pkg = await loadPackage(options.source, trust)
  const files = buildPlanFiles(pkg)
  const output = await writePlan(pkg, files)
  console.log(JSON.stringify({
    mode: options.mode,
    backend: options.backend,
    dry_run: options.dryRun,
    import_run_id: pkg.importRunId,
    package_id: pkg.manifest.package_id,
    source_files: pkg.exports.length,
    source_rows: pkg.exports.reduce(
      (total, item) => total + (item.sourceRows?.length ?? 0), 0,
    ),
    repair_findings: pkg.exports.reduce(
      (total, item) => total + (item.findings?.length ?? 0), 0,
    ),
    sql_plan: output.directory,
  }, null, 2))
  if (options.dryRun) {
    console.log("Dry run complete; no database connection was attempted.")
    return
  }
  await confirmExecution(CONFIRM_PHRASE)
  const workspaceRoot = process.cwd()
  const backend: ExecutionBackend = options.backend === "psql" ? {
    kind: "psql", environment: buildPgEnvironment(), workspaceRoot,
  } : {
    kind: "supabase-cli", environment: buildCliEnvironment(), workspaceRoot,
  }
  if (backend.kind === "supabase-cli") {
    await prepareCliBackend(workspaceRoot, backend.environment)
  }
  if (options.mode === "import") await executePlan(output, backend)
  await verifyPackage(pkg, output, backend)
}
