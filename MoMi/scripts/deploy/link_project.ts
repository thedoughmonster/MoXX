import { workspaceRoot } from "../architecture/paths.ts"
import { runSupabase } from "./run_supabase.ts"

export function linkProject(projectRef: string): void {
  runSupabase([
    "link",
    "--project-ref",
    projectRef,
    "--workdir",
    workspaceRoot,
    "--yes",
  ])
}
