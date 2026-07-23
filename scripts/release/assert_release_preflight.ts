import { loadWorkspace } from "../architecture/load_workspace.ts"
import { workspaceRoot } from "../architecture/paths.ts"
import { linkProject } from "../deploy/link_project.ts"
import { runSupabaseDatabase } from "../deploy/run_supabase_database.ts"
import type { EnvironmentKey } from "../deploy/types.ts"
import { assertDeployedDevelopmentBaseline } from
  "./assert_deployed_development_baseline.ts"
import { assertLinkedSupabaseAccess } from
  "./assert_linked_supabase_access.ts"
import { assertLinkedSupabaseTarget } from
  "./assert_linked_supabase_target.ts"
import { migrationDatabaseUrl } from "./migration_database_url.ts"
import { releaseRequiresMigrations } from
  "./release_requires_migrations.ts"
import { runCommand } from "./run_command.ts"
import { resolveDevelopmentBaseline } from
  "./resolve_development_baseline.ts"
import type { ReleasePreflight } from "./types.ts"

export async function assertReleasePreflight(
  environment: EnvironmentKey,
): Promise<ReleasePreflight> {
  if (!process.versions.node.startsWith("24.")) {
    throw new Error(`Node 24 is required; found ${process.versions.node}`)
  }
  const clean = runCommand("git", ["status", "--porcelain"], { capture: true })
  if (clean.stdout.trim()) throw new Error("Commit or remove local changes first")
  const branch = runCommand("git", ["branch", "--show-current"], {
    capture: true,
  }).stdout.trim()
  if (!branch || branch === "prod") throw new Error("Never release from prod")
  if (environment === "prod" && branch !== "dev") {
    throw new Error("Production releases must start from dev")
  }
  runCommand("gh", ["auth", "status"])
  runCommand("git", [
    "fetch",
    "origin",
    "dev:refs/remotes/origin/dev",
    "prod:refs/remotes/origin/prod",
  ])
  const headSha = runCommand("git", ["rev-parse", "HEAD"], {
    capture: true,
  }).stdout.trim()
  const devSha = runCommand("git", ["rev-parse", "origin/dev"], {
    capture: true,
  }).stdout.trim()
  if (branch === "dev" && headSha !== devSha) {
    throw new Error("Local dev must exactly match origin/dev")
  }
  if (branch !== "dev") {
    const ancestry = runCommand(
      "git",
      ["merge-base", "--is-ancestor", "origin/dev", "HEAD"],
      { capture: true, allowFailure: true },
    )
    if (ancestry.status !== 0) throw new Error("Feature branch must include current dev")
  }
  const migrationDiff = runCommand("git", [
    "diff", "--quiet", "origin/dev...HEAD", "--", "supabase/migrations",
  ], { allowFailure: true })
  const requiresMigrationApply = releaseRequiresMigrations(
    environment,
    branch,
    migrationDiff.status,
  )
  if (requiresMigrationApply) {
    const workspace = await loadWorkspace()
    const projectRef = workspace.environments[environment].project_ref
    linkProject(projectRef)
    const poolerUrl = assertLinkedSupabaseTarget(projectRef)
    const databaseUrl = migrationDatabaseUrl(poolerUrl, projectRef)
    const access = runSupabaseDatabase([
      "db", "query", "--db-url", databaseUrl,
      "--workdir", workspaceRoot, "--output", "json",
      "select 1::integer as release_access_check",
    ], true)
    assertLinkedSupabaseAccess(access)
  } else {
    assertDeployedDevelopmentBaseline(devSha)
  }
  const developmentBaseline = resolveDevelopmentBaseline(branch, headSha, devSha)
  const previousDevRef = process.env.MOMI_DEV_REF
  process.env.MOMI_DEV_REF = developmentBaseline
  try {
    runCommand(process.execPath, ["scripts/check.ts", "--service", "all"])
  } finally {
    if (previousDevRef === undefined) delete process.env.MOMI_DEV_REF
    else process.env.MOMI_DEV_REF = previousDevRef
  }
  return { environment, branch, headSha, requiresMigrationApply }
}
