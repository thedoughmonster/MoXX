import type { HostedFunction } from "./types.ts"
import { parseHostedFunctions } from "./parse_hosted_functions.ts"
import { runSupabase } from "./run_supabase.ts"

export function listHostedFunctions(projectRef: string): HostedFunction[] {
  const output = runSupabase([
    "functions",
    "list",
    "--project-ref",
    projectRef,
    "--output",
    "json",
  ], true)
  return parseHostedFunctions(output)
}
