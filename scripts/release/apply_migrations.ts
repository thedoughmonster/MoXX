import { loadWorkspace } from "../architecture/load_workspace.ts"
import { workspaceRoot } from "../architecture/paths.ts"
import { linkProject } from "../deploy/link_project.ts"
import { runSupabaseDatabase } from "../deploy/run_supabase_database.ts"
import type { EnvironmentKey } from "../deploy/types.ts"
import { assertLinkedSupabaseTarget } from
  "./assert_linked_supabase_target.ts"
import { assertMigrationParity } from "./assert_migration_parity.ts"
import { migrationDatabaseUrl } from "./migration_database_url.ts"

export async function applyMigrations(environment: EnvironmentKey): Promise<void> {
  const workspace = await loadWorkspace()
  const projectRef = workspace.environments[environment].project_ref
  console.log(`Linking ${environment} database through the IPv4 session pooler...`)
  linkProject(projectRef)
  const poolerUrl = assertLinkedSupabaseTarget(projectRef)
  const databaseUrl = migrationDatabaseUrl(poolerUrl, projectRef)
  runSupabaseDatabase([
    "db", "push", "--db-url", databaseUrl, "--dry-run", "--yes",
    "--workdir", workspaceRoot,
  ])
  runSupabaseDatabase([
    "db", "push", "--db-url", databaseUrl, "--yes", "--workdir", workspaceRoot,
  ])
  const hosted = runSupabaseDatabase([
    "db", "query", "--db-url", databaseUrl,
    "--workdir", workspaceRoot, "--output", "json",
    "select version from supabase_migrations.schema_migrations order by version",
  ], true)
  assertMigrationParity(hosted)
}
