import { workspaceRoot } from "../architecture/paths.ts"
import { migrationDatabaseUrl } from "./migration_database_url.ts"
import { runSupabase } from "./run_supabase.ts"

export function planMigrations(): void {
  runSupabase([
    "db",
    "push",
    "--db-url",
    migrationDatabaseUrl(),
    "--dry-run",
    "--workdir",
    workspaceRoot,
  ])
}
