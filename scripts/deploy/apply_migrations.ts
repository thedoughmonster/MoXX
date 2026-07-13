import { workspaceRoot } from "../architecture/paths.ts"
import { migrationDatabaseUrl } from "./migration_database_url.ts"
import { runSupabase } from "./run_supabase.ts"

export function applyMigrations(): void {
  runSupabase([
    "db",
    "push",
    "--db-url",
    migrationDatabaseUrl(),
    "--workdir",
    workspaceRoot,
    "--yes",
  ])
}
