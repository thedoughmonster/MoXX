import type { JSONValue } from "postgres"
import { usage } from "./provider_usage.ts"

export function outputTokens(body: Record<string, JSONValue>): number {
  const data = usage(body)
  if (typeof data.output_tokens === "number") return data.output_tokens
  return typeof data.completion_tokens === "number" ? data.completion_tokens : 0
}
