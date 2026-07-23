import type { JSONValue } from "postgres"

export function toolCalls(message: JSONValue): JSONValue[] {
  if (!message || typeof message !== "object" || Array.isArray(message) ||
    message instanceof Date) return []
  const calls = (message as Record<string, JSONValue>).tool_calls
  return Array.isArray(calls) ? [...calls] : []
}
