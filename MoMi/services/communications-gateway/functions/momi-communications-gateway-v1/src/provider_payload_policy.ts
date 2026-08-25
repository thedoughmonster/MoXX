import type { JSONValue } from "postgres"

export function estimateProviderPayloadTokens(
  payload: Record<string, JSONValue>,
): number {
  return Math.max(1, Math.ceil(JSON.stringify(payload).length / 4))
}
