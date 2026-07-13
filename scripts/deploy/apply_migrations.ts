import { workspaceRoot } from "../architecture/paths.ts"
import { runSupabase } from "./run_supabase.ts"

export function applyMigrations(): void {
  runSupabase([
    "db",
    "push",
    "--linked",
    "--workdir",
    workspaceRoot,
    "--yes",
  ])
}
