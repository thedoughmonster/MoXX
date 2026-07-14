import { readFileSync } from "node:fs"
import { join } from "node:path"

import { loadWorkspace } from "../architecture/load_workspace.ts"
import { workspaceRoot } from "../architecture/paths.ts"
import { linkProject } from "../deploy/link_project.ts"
import { runSupabase } from "../deploy/run_supabase.ts"
import type { EnvironmentKey } from "../deploy/types.ts"
import { assertMigrationParity } from "./assert_migration_parity.ts"

export async function applyMigrations(environment: EnvironmentKey): Promise<void> {
  const workspace = await loadWorkspace()
  const projectRef = workspace.environments[environment].project_ref
  console.log(`Linking ${environment} database through the IPv4 session pooler...`)
  linkProject(projectRef)
  const pooler = readFileSync(
    join(workspaceRoot, "supabase", ".temp", "pooler-url"),
    "utf8",
  ).trim()
  if (!/\.pooler\.supabase\.com:5432\/postgres$/.test(pooler)) {
    throw new Error("Supabase did not select the IPv4 session pooler")
  }
  runSupabase([
    "db", "push", "--linked", "--dry-run", "--yes",
    "--workdir", workspaceRoot,
  ])
  runSupabase([
    "db", "push", "--linked", "--yes", "--workdir", workspaceRoot,
  ])
  const linked = runSupabase([
    "db", "query", "--linked", "--workdir", workspaceRoot, "--output", "json",
    "select version from supabase_migrations.schema_migrations order by version",
  ], true)
  assertMigrationParity(linked)
}
