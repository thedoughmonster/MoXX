import type { JSONValue } from "postgres"
import type { Usage } from "./types.ts"

export function providerUsage(
  body: Record<string, JSONValue>,
  inputRate: string,
  outputRate: string,
): Usage {
  const value = body.usage
  const usage = value && typeof value === "object" && !Array.isArray(value) &&
      !(value instanceof Date) ? value as Record<string, JSONValue> : {}
  const input = typeof usage.input_tokens === "number" ? usage.input_tokens : null
  const output = typeof usage.output_tokens === "number" ? usage.output_tokens : null
  const inputDetails = usage.input_tokens_details &&
      typeof usage.input_tokens_details === "object" &&
      !Array.isArray(usage.input_tokens_details) &&
      !(usage.input_tokens_details instanceof Date)
    ? usage.input_tokens_details as Record<string, JSONValue> : {}
  const outputDetails = usage.output_tokens_details &&
      typeof usage.output_tokens_details === "object" &&
      !Array.isArray(usage.output_tokens_details) &&
      !(usage.output_tokens_details instanceof Date)
    ? usage.output_tokens_details as Record<string, JSONValue> : {}
  const cached = typeof inputDetails.cached_tokens === "number"
    ? inputDetails.cached_tokens : null
  const reasoning = typeof outputDetails.reasoning_tokens === "number"
    ? outputDetails.reasoning_tokens : null
  const cost = input === null || output === null ? null
    : Math.ceil((input * Number(inputRate)) + (output * Number(outputRate)))
  return { input_tokens: input, cached_input_tokens: cached,
    output_tokens: output, reasoning_tokens: reasoning,
    billed_cost_micros: Number.isFinite(cost) ? cost : null }
}
