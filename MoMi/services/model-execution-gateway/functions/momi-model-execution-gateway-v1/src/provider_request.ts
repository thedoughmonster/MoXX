import type { JSONValue } from "postgres"
import type { Admission, CreateRequest } from "./types.ts"

export function providerRequest(
  request: CreateRequest,
  admission: Admission,
): Record<string, JSONValue> {
  return {
    ...request.payload,
    model: admission.provider_model,
    reasoning: { effort: admission.reasoning_effort },
    max_output_tokens: Math.min(
      request.requested_output_tokens,
      admission.maximum_output_tokens,
    ),
    store: false,
    ...(request.background ? { background: true } : {}),
  }
}
