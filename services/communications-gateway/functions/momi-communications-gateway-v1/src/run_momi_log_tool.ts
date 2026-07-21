import type { JSONValue } from "postgres"
import type { ToolContext, UserFlag } from "./types.ts"

type Append = (flag: UserFlag, content: Record<string, JSONValue>,
  context: ToolContext) => Promise<JSONValue>

export async function runMomiLogTool(
  value: unknown,
  context: ToolContext,
  append: Append,
): Promise<JSONValue> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).length !== 0) return { error: "invalid_tool_arguments" }
  if (!context.logSelection) return { error: "explicit_user_flag_required" }
  return await append(context.logSelection.flag, context.logSelection.content, context)
}
