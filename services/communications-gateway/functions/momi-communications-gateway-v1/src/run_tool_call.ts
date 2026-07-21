import type { JSONValue } from "postgres"
import { createUserFlagLog } from "./create_user_flag_log.ts"
import { hasLogIntent } from "./has_log_intent.ts"
import { runCanonicalTool } from "./run_canonical_tool.ts"
import type { ToolContext, UserFlag } from "./types.ts"

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
  if (name === "get_momi_canonical_record") return runCanonicalTool(args, context)
  if (name === "create_momi_log") {
    if (!hasLogIntent(context.input) || !args || typeof args !== "object" || Array.isArray(args)) {
      return { error: "explicit_user_flag_required" }
    }
    const record = args as Record<string, unknown>
    const scopes = new Set(["message", "turn", "range", "conversation"])
    if (typeof record.scope !== "string" || !scopes.has(record.scope) ||
      !record.content || typeof record.content !== "object" || Array.isArray(record.content)) {
      return { error: "invalid_tool_arguments" }
    }
    const flag: UserFlag = { scope: record.scope as UserFlag["scope"],
      note: typeof record.note === "string" ? record.note : undefined,
      category: typeof record.category === "string" ? record.category : undefined }
    return createUserFlagLog(flag, record.content as Record<string, JSONValue>, context)
  }
  return { error: "tool_not_allowlisted" }
}
