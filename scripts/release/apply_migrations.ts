import { join } from "node:path"

import { loadWorkspace } from "../architecture/load_workspace.ts"
import { workspaceRoot } from "../architecture/paths.ts"
import { linkProject } from "../deploy/link_project.ts"
import { runSupabase } from "../deploy/run_supabase.ts"
import type { EnvironmentKey } from "../deploy/types.ts"
import { loadLocalMigrations } from "../migrations/load_local_migrations.ts"
import { assertLinkedProjectRef } from "./assert_linked_project_ref.ts"
import { executeMigrationRelease } from "./execute_migration_release.ts"

export async function applyMigrations(
  environment: EnvironmentKey,
  authorizedVersions: string[],
): Promise<void> {
  const workspace = await loadWorkspace()
  const projectRef = workspace.environments[environment].project_ref
  const migrations = await loadLocalMigrations(
    join(workspaceRoot, "supabase", "migrations"),
  )
  console.log(`Linking ${environment} database with a temporary CLI login role...`)
  linkProject(projectRef)
  assertLinkedProjectRef(projectRef)
  const pushArgs = (includeAll: boolean, dryRun: boolean): string[] => [
    "db", "push", "--linked",
    ...(includeAll ? ["--include-all"] : []),
    ...(dryRun ? ["--dry-run"] : []),
    "--yes", "--workdir", workspaceRoot,
  ]
  const readHosted = (): string => runSupabase([
    "db", "query", "--linked",
    "--workdir", workspaceRoot, "--output", "json",
    "select version from supabase_migrations.schema_migrations order by version",
  ], true)
  executeMigrationRelease([...migrations.keys()], authorizedVersions, {
    readHosted,
    preview: (includeAll) =>
      runSupabase(pushArgs(includeAll, true), "combined"),
    apply: (includeAll) => {
      runSupabase(pushArgs(includeAll, false))
    },
  })
}
