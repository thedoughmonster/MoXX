import { sql } from "./database.ts"
import type { PreparedMessage } from "./types.ts"

export async function loadPreparedMessage(
  workId: string,
): Promise<PreparedMessage | null> {
  const rows = await sql<PreparedMessage[]>`
    select
      message.delivery_work_id::text,
      message.candidate_id::text,
      message.destination_key,
      message.destination_enabled,
      message.slack_channel_id,
      message.message_payload
    from toast_alerting.slack_order_alert_messages_v1 as message
    where message.delivery_work_id = ${workId}::bigint
  `

  if (rows.length > 1) {
    throw new Error("Slack delivery work resolved multiple prepared messages")
  }

  return rows[0] ?? null
}
