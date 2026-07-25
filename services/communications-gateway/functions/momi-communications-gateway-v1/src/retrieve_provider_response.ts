import type { JSONValue } from "postgres"
import type { ProviderResult } from "./types.ts"

export async function retrieveProviderResponse(
  callId: string,
  responseId: string,
  deadlineAt: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderResult> {
  const endpoint = Deno.env.get("MOMI_MODEL_EXECUTION_GATEWAY_URL")?.trim()
  const secret = Deno.env.get("MOMI_MODEL_GATEWAY_COMMUNICATIONS_SECRET")?.trim()
  if (!endpoint || !secret) throw new Error("model gateway configuration is unavailable")
  const started = performance.now()
  try {
    const response = await fetchImpl(endpoint, { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ schema_version: 1, operation: "retrieve", call_id: callId,
        provider_response_id: responseId, deadline_at: deadlineAt }),
      signal: AbortSignal.timeout(Math.max(1, Date.parse(deadlineAt) - Date.now())) })
    const value: unknown = await response.json().catch(() => null)
    if (!response.ok || !value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, ambiguous: false, status: response.status,
        body: { error: { type: "provider_background_poll_failed" } },
        duration_ms: Math.round(performance.now() - started), gateway_call_id: callId,
        provider_model: "unknown" }
    }
    const result = value as Record<string, unknown>
    if (typeof result.ok !== "boolean" || typeof result.ambiguous !== "boolean" ||
      typeof result.status !== "number" || !result.body ||
      typeof result.body !== "object" || Array.isArray(result.body) ||
      typeof result.provider_model !== "string") throw new Error("invalid gateway response")
    return { ok: result.ok, ambiguous: result.ambiguous, status: result.status,
      body: result.body as Record<string, JSONValue>,
      duration_ms: typeof result.duration_ms === "number" ? result.duration_ms : 0,
      gateway_call_id: callId, provider_model: result.provider_model }
  } catch {
    return { ok: false, ambiguous: false, status: 0,
      body: { error: { type: "provider_background_poll_failed" } },
      duration_ms: Math.round(performance.now() - started), gateway_call_id: callId,
      provider_model: "unknown" }
  }
}
