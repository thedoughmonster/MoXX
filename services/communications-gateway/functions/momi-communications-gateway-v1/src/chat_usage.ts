import type { JSONValue } from "postgres"
import { usage } from "./provider_usage.ts"

export function chatUsage(body: Record<string, JSONValue>): Record<string, JSONValue> {
  const source = usage(body)
  const prompt = typeof source.input_tokens === "number" ? source.input_tokens : 0
  const completion = typeof source.output_tokens === "number" ? source.output_tokens : 0
  const inputDetails = source.input_tokens_details
  const outputDetails = source.output_tokens_details
  const cached = inputDetails && typeof inputDetails === "object" && !Array.isArray(inputDetails)
    ? (inputDetails as Record<string, JSONValue>).cached_tokens : null
  const reasoning = outputDetails && typeof outputDetails === "object" && !Array.isArray(outputDetails)
    ? (outputDetails as Record<string, JSONValue>).reasoning_tokens : null
  return { prompt_tokens: prompt, completion_tokens: completion,
    total_tokens: typeof source.total_tokens === "number"
      ? source.total_tokens : prompt + completion,
    ...(typeof cached === "number" ? { prompt_tokens_details: { cached_tokens: cached } } : {}),
    ...(typeof reasoning === "number"
      ? { completion_tokens_details: { reasoning_tokens: reasoning } } : {}) }
}
