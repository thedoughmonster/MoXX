import type { JSONValue } from "postgres"
import { resolveLogSelection } from "./resolve_log_selection.ts"
import type { ChatInput, ToolContext, UserFlag } from "./types.ts"

type Append = (flag: UserFlag, content: Record<string, JSONValue>,
  context: ToolContext) => Promise<JSONValue>

export async function appendLogSelection(
  input: ChatInput,
  context: ToolContext,
  append: Append,
): Promise<JSONValue | null> {
  const selection = resolveLogSelection(input)
  return selection ? await append(selection.flag, selection.content, context) : null
}
