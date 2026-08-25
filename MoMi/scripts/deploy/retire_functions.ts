import type { Architecture } from "../architecture/types.ts"
import type { EnvironmentKey, HostedFunction } from "./types.ts"
import { runSupabase } from "./run_supabase.ts"

export function retireFunctions(
  architecture: Architecture,
  environment: EnvironmentKey,
  projectRef: string,
  requested: string[],
  hosted: HostedFunction[],
  today = new Date().toISOString().slice(0, 10),
  run: typeof runSupabase = runSupabase,
): string[] {
  const active = new Set(architecture.functions.map((item) => item.slug))
  const selected = requested.map((slug) => {
    const retirement = architecture.retirements.find((item) =>
      item.function_slug === slug && item.environments.includes(environment)
    )
    if (!retirement) throw new Error(`${slug}: no ${environment} retirement manifest`)
    if (active.has(slug)) throw new Error(`${slug}: active functions cannot be retired`)
    if (retirement.remove_after >= today) {
      throw new Error(`${slug}: removal date has not passed`)
    }
    if (!retirement.removal_evidence || retirement.removal_evidence.verified_at > today) {
      throw new Error(`${slug}: caller-verified removal evidence is required`)
    }
    return retirement
  })
  const hostedSlugs = new Set(hosted.map((item) => item.slug))
  const removed = selected.filter((item) => hostedSlugs.has(item.function_slug))
  for (const retirement of removed) {
    run(["functions", "delete", retirement.function_slug, "--project-ref", projectRef])
  }
  return removed.map((item) => item.function_slug)
}
