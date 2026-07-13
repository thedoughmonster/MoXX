import { workspaceRoot } from "../architecture/paths.ts"
import { runSupabase } from "./run_supabase.ts"

export function planMigrations(): void {
  runSupabase([
    "db",
    "push",
    "--linked",
    "--dry-run",
    "--workdir",
    workspaceRoot,
  ])
}
