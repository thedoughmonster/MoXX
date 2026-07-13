import type { LoadedFunction } from "../architecture/types.ts"
import { workspaceRoot } from "../architecture/paths.ts"
import { runSupabase } from "./run_supabase.ts"

export function deployFunctions(
  projectRef: string,
  functions: LoadedFunction[],
): void {
  const slugs = functions.map((item) => item.slug).sort()
  runSupabase([
    "functions",
    "deploy",
    ...slugs,
    "--project-ref",
    projectRef,
    "--use-api",
    "--jobs",
    "3",
    "--workdir",
    workspaceRoot,
  ])
}
