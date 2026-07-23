import type { JSONValue } from "postgres"
import { createUserFlagLog } from "./create_user_flag_log.ts"
import { runMomiLogTool } from "./run_momi_log_tool.ts"
import type { ToolContext } from "./types.ts"

export async function executeMomiLogTool(
  value: unknown,
  context: ToolContext,
): Promise<JSONValue> {
  return await runMomiLogTool(value, context, createUserFlagLog)
}
