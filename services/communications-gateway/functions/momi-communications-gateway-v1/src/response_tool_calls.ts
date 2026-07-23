import type { JSONValue } from "postgres"
import { responseItems } from "./response_items.ts"
import type { ToolCall } from "./types.ts"

export function responseToolCalls(body: Record<string, JSONValue>): ToolCall[] {
  const calls: ToolCall[] = []
  for (const item of responseItems(body)) {
    if (!item || typeof item !== "object" || Array.isArray(item) || item instanceof Date) continue
    const value = item as Record<string, JSONValue>
    if (value.type !== "function_call" || typeof value.call_id !== "string" ||
      typeof value.name !== "string" || typeof value.arguments !== "string") continue
    calls.push({ id: value.call_id, type: "function",
      function: { name: value.name, arguments: value.arguments } })
  }
  return calls
}
