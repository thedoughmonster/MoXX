import { setTimeout as delay } from "node:timers/promises"

export type AdvisorKind = "performance" | "security"

type AdvisorFetcher = (
  input: string,
  init: RequestInit,
) => Promise<Response>

export async function readAdvisor(
  projectRef: string,
  kind: AdvisorKind,
  fetcher: AdvisorFetcher = fetch,
): Promise<Record<string, unknown>[]> {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/advisors/${kind}`
  const headers = { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN!}` }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let response: Response
    try {
      response = await fetcher(url, {
        headers,
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      if (attempt === 2) {
        throw new Error(`Unable to read Supabase ${kind} advisors (transport error)`)
      }
      await delay(1_000)
      continue
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500
      if (!retryable || attempt === 2) {
        throw new Error(
          `Unable to read Supabase ${kind} advisors (HTTP ${response.status})`,
        )
      }
      const retryAfter = Number(response.headers.get("retry-after") ?? "1")
      const seconds = Number.isFinite(retryAfter)
        ? Math.min(Math.max(retryAfter, 0), 5)
        : 1
      await delay(seconds * 1_000)
      continue
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new Error(`Invalid Supabase ${kind} advisors response (JSON)`)
    }
    const lints = (payload as { lints?: unknown } | null)?.lints
    if (!Array.isArray(lints)) {
      throw new Error(`Invalid Supabase ${kind} advisors response (lints)`)
    }
    for (const lint of lints) {
      if (typeof lint !== "object" || lint === null || Array.isArray(lint)) {
        throw new Error(`Invalid Supabase ${kind} advisors response (lints)`)
      }
    }
    return lints as Record<string, unknown>[]
  }
  throw new Error(`Unable to read Supabase ${kind} advisors`)
}
