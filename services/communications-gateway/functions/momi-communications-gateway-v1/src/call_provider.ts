import type { JSONValue } from "postgres"
import type { ProviderResult } from "./types.ts"

export async function callProvider(
  endpoint: string,
  requestBody: Record<string, JSONValue>,
  timeoutSeconds: number,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderResult> {
  const apiKey = Deno.env.get("MOMI_BETA_PROVIDER_API_KEY") ??
    Deno.env.get("OPENAI_API_KEY")
  if (!apiKey) throw new Error("provider configuration is unavailable")
  const started = performance.now()
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutSeconds * 1000),
    })
    const parsed: unknown = await response.json().catch(() => null)
    const body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, JSONValue>
      : { error: { type: "provider_invalid_json" } }
    return { ok: response.ok, ambiguous: false, status: response.status,
      body, duration_ms: Math.round(performance.now() - started) }
  } catch {
    return { ok: false, ambiguous: true, status: 0,
      body: { error: { type: "provider_transport_ambiguous" } },
      duration_ms: Math.round(performance.now() - started) }
  }
}
