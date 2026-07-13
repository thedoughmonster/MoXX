import type { AdvisorResult } from "./types.ts"

export async function readAdvisors(projectRef: string): Promise<AdvisorResult> {
  const token = process.env.SUPABASE_ACCESS_TOKEN!
  const headers = { Authorization: `Bearer ${token}` }
  const base = `https://api.supabase.com/v1/projects/${projectRef}/advisors`
  const [securityResponse, performanceResponse] = await Promise.all([
    fetch(`${base}/security`, { headers }),
    fetch(`${base}/performance`, { headers }),
  ])
  if (!securityResponse.ok || !performanceResponse.ok) {
    throw new Error("Unable to read Supabase advisors")
  }
  const security = await securityResponse.json() as { lints?: Record<string, unknown>[] }
  const performance = await performanceResponse.json() as { lints?: Record<string, unknown>[] }
  return {
    security: security.lints ?? [],
    performance: performance.lints ?? [],
  }
}
