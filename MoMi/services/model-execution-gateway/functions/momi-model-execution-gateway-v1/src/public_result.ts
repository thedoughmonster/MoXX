import type { JSONValue } from "postgres"
import type { ProviderResult } from "./types.ts"

export function publicResult(
  callId: string,
  providerModel: string,
  result: ProviderResult,
): Record<string, JSONValue> {
  return { ok: result.ok, ambiguous: result.ambiguous, status: result.status,
    body: result.body, duration_ms: result.duration_ms,
    call_id: callId, provider_model: providerModel }
}
