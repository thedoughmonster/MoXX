import type { JSONValue } from "postgres"
import { providerUsage } from "./provider_usage.ts"
import { safeErrorCategory } from "./safe_error_category.ts"
import type { ProviderConfig, ProviderResult } from "./types.ts"

export async function executeProvider(
  config: ProviderConfig,
  method: "POST" | "GET",
  path: string,
  deadlineAt: string,
  body: Record<string, JSONValue> | null,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim()
  if (!apiKey) throw new Error("provider credential is unavailable")
  const remaining = Date.parse(deadlineAt) - Date.now()
  if (!Number.isFinite(remaining) || remaining <= 0) throw new Error("request deadline expired")
  const timeout = Math.max(1, Math.min(config.timeout_seconds * 1000, remaining))
  const startedAt = new Date().toISOString()
  const started = performance.now()
  try {
    const response = await fetchImpl(`${config.provider_endpoint}${path.slice(13)}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`,
        "X-Client-Request-Id": config.x_client_request_id },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeout),
    })
    const parsed: unknown = await response.json().catch(() => null)
    const value: Record<string, JSONValue> = parsed &&
        typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, JSONValue>
      : { error: { type: "provider_invalid_json" } }
    const usage = providerUsage(value, config.input_micros_per_token,
      config.output_micros_per_token)
    return { ok: response.ok, ambiguous: false, status: response.status, body: value,
      duration_ms: Math.round(performance.now() - started),
      provider_request_id: response.headers.get("x-request-id"),
      provider_response_id: typeof value.id === "string" ? value.id : null,
      error_category: safeErrorCategory(value, response.status, false),
      started_at: startedAt, method, request_path: path, ...usage }
  } catch {
    return { ok: false, ambiguous: method === "POST", status: 0,
      body: { error: { type: method === "POST" ? "provider_transport_ambiguous"
        : "provider_retrieval_failed" } },
      duration_ms: Math.round(performance.now() - started), provider_request_id: null,
      provider_response_id: null,
      error_category: method === "POST" ? "provider_transport_ambiguous"
        : "provider_retrieval_failed", started_at: startedAt, method,
      request_path: path, input_tokens: null, cached_input_tokens: null,
      output_tokens: null, reasoning_tokens: null, billed_cost_micros: null }
  }
}
