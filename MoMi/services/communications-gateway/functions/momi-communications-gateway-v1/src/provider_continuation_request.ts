import type { JSONValue } from "postgres"

export function providerContinuationRequest(request: Record<string, JSONValue>,
  output: JSONValue[], toolOutputs: JSONValue[]): Record<string, JSONValue> {
  const originalInput = Array.isArray(request.input) ? request.input : []
  return { ...request, input: [...originalInput, ...output, ...toolOutputs] }
}
