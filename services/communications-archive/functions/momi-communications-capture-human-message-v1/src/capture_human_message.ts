import { getDatabase } from "./database.ts"
import type { HumanMessageInput, HumanMessageReceipt } from "./types.ts"

export async function captureHumanMessage(
  input: HumanMessageInput,
): Promise<HumanMessageReceipt> {
  const sql = getDatabase()
  const rows = await sql<HumanMessageReceipt[]>`
    select disposition, archive_item_id::text, content_hash
    from momi_communications.capture_human_message_v1(
      ${input.source_account_key}, ${input.source_user_key},
      ${input.source_conversation_key}, ${input.source_message_key},
      ${input.source_parent_message_key ?? null}, ${input.sender_role},
      ${input.content}, ${sql.json(input.source_metadata)},
      ${input.idempotency_key}, ${input.occurred_at}::timestamptz
    )
  `
  if (!rows[0]) throw new Error("archive receipt unavailable")
  return rows[0]
}
