import { readFileSync } from "node:fs"
import { join } from "node:path"

import { loadWorkspace } from "../architecture/load_workspace.ts"
import { workspaceRoot } from "../architecture/paths.ts"
import { linkProject } from "../deploy/link_project.ts"
import { runSupabase } from "../deploy/run_supabase.ts"
import type { EnvironmentKey } from "../deploy/types.ts"
import { assertMigrationParity } from "./assert_migration_parity.ts"
import { assertSupabaseDbPassword } from "./assert_supabase_db_password.ts"
import { migrationDatabaseUrl } from "./migration_database_url.ts"

export async function applyMigrations(environment: EnvironmentKey): Promise<void> {
  const workspace = await loadWorkspace()
  const projectRef = workspace.environments[environment].project_ref
  const databasePassword = assertSupabaseDbPassword()
  console.log(`Linking ${environment} database through the IPv4 session pooler...`)
  linkProject(projectRef)
  const databaseUrl = migrationDatabaseUrl(readFileSync(
    join(workspaceRoot, "supabase", ".temp", "pooler-url"),
    "utf8",
  ).trim(), projectRef)
  runSupabase([
    "db", "push", "--db-url", databaseUrl, "--dry-run", "--yes",
    "--workdir", workspaceRoot,
  ], false, databasePassword)
  runSupabase([
    "db", "push", "--db-url", databaseUrl, "--yes", "--workdir", workspaceRoot,
  ], false, databasePassword)
  const hosted = runSupabase([
    "db", "query", "--db-url", databaseUrl,
    "--workdir", workspaceRoot, "--output", "json",
    "select version from supabase_migrations.schema_migrations order by version",
  ], true, databasePassword)
  assertMigrationParity(hosted)
}
