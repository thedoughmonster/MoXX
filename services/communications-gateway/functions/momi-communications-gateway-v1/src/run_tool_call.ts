import type { JSONValue } from "postgres"
import { runCanonicalTool } from "./run_canonical_tool.ts"
import { runShopAnalysisTool } from "./run_shop_analysis_tool.ts"
import type { ToolContext } from "./types.ts"

export function runToolCall(
  call: Record<string, JSONValue>,
  context: ToolContext,
): JSONValue | Promise<JSONValue> {
  const rawDefinition = call.function
  if (!rawDefinition || typeof rawDefinition !== "object" ||
    Array.isArray(rawDefinition) || rawDefinition instanceof Date) {
    return { error: "invalid_tool_call" }
  }
  const definition = rawDefinition as Record<string, JSONValue>
  const name = definition.name
  if (typeof definition.arguments !== "string") return { error: "invalid_tool_call" }
  let args: unknown
  try { args = JSON.parse(definition.arguments) } catch { return { error: "invalid_tool_arguments" } }
  if (name === "query_momi_shop_data") return runShopAnalysisTool(args)
  if (name === "get_momi_canonical_record") return runCanonicalTool(args, context)
  return { error: "tool_not_allowlisted" }
}
