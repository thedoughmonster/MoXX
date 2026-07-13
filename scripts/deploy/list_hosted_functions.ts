import type { HostedFunction } from "./types.ts"
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
  const rows = JSON.parse(output) as Array<Record<string, unknown>>
  return rows.map((row) => ({
    slug: String(row.slug ?? row.name),
    status: String(row.status ?? "UNKNOWN"),
    version: Number(row.version ?? 0),
  })).sort((left, right) => left.slug.localeCompare(right.slug))
}
