import type { JSONValue } from "postgres"
import { getDatabase } from "./database.ts"
import type { ToolContext, UserFlag } from "./types.ts"

export async function createUserFlagLog(
  flag: UserFlag,
  content: Record<string, JSONValue>,
  context: ToolContext,
): Promise<JSONValue> {
  const sql = getDatabase()
  const rows = await sql<{ disposition: string; selection_id: string; shop_log_id: string }[]>`
    select disposition, selection_id::text, shop_log_id::text
    from momi_communications_operations.create_user_flagged_shop_log_v1(
      ${context.input.user.id}::uuid, 'user_flag', ${flag.scope},
      ${context.input.conversation_id}, ${flag.message_id ?? null},
      ${context.input.turn_id}, ${sql.json(flag.range ?? null)},
      ${context.invocationId}::uuid, ${context.archiveReceiptId}::uuid,
      ${flag.note ?? null}, ${flag.category ?? null}, ${sql.json(content)},
      null, null, ${context.input.idempotency_key + ":user-flag"}
    )
  `
  return rows[0] ?? { error: "curated_log_append_failed" }
}
