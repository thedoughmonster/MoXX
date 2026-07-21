import type { JSONValue } from "postgres"
import type { LogSelection, ToolContext, UserFlag } from "./types.ts"

type Append = (flag: UserFlag, content: Record<string, JSONValue>,
  context: ToolContext) => Promise<JSONValue>

export async function appendLogSelection(
  selection: LogSelection | null,
  context: ToolContext,
  append: Append,
): Promise<JSONValue | null> {
  return selection ? await append(selection.flag, selection.content, context) : null
}
