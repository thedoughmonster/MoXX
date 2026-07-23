import { loadWorkspace } from "../architecture/load_workspace.ts"
import { workspaceRoot } from "../architecture/paths.ts"
import { linkProject } from "../deploy/link_project.ts"
import { runSupabase } from "../deploy/run_supabase.ts"
import type { EnvironmentKey } from "../deploy/types.ts"
import { assertLinkedProjectRef } from "./assert_linked_project_ref.ts"
import { assertMigrationParity } from "./assert_migration_parity.ts"

export async function applyMigrations(environment: EnvironmentKey): Promise<void> {
  const workspace = await loadWorkspace()
  const projectRef = workspace.environments[environment].project_ref
  console.log(`Linking ${environment} database with a temporary CLI login role...`)
  linkProject(projectRef)
  assertLinkedProjectRef(projectRef)
  runSupabase([
    "db", "push", "--linked", "--dry-run", "--yes",
    "--workdir", workspaceRoot,
  ])
  runSupabase([
    "db", "push", "--linked", "--yes", "--workdir", workspaceRoot,
  ])
  const hosted = runSupabase([
    "db", "query", "--linked",
    "--workdir", workspaceRoot, "--output", "json",
    "select version from supabase_migrations.schema_migrations order by version",
  ], true)
  assertMigrationParity(hosted)
}
