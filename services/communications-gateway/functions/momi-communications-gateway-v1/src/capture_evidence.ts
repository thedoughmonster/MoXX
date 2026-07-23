import type { JSONValue } from "postgres"
import { getDatabase } from "./database.ts"
import type { ArchiveReceipt, ChatInput } from "./types.ts"

export async function captureEvidence(
  input: ChatInput,
  invocationId: string,
  order: number,
  phase: string,
  payload: Record<string, JSONValue>,
  providerKey: string,
  providerModel: string,
  terminalStatus: string,
  usage: Record<string, JSONValue> = {},
  timing: Record<string, JSONValue> = {},
): Promise<ArchiveReceipt> {
  const sql = getDatabase()
  const rows = await sql<ArchiveReceipt[]>`
    select disposition, archive_item_id::text, content_hash
    from momi_communications.capture_gateway_exchange_v1(
      ${invocationId}::uuid, ${input.user.id}::uuid, ${input.conversation_id},
      ${input.turn_id}, ${order}, ${phase}, ${sql.json(payload)},
      ${providerKey}, ${providerModel}, ${terminalStatus}, ${sql.json(usage)},
      ${sql.json(timing)}, ${input.idempotency_key + ":" + order + ":" + phase}, now()
    )
  `
  if (!rows[0]) throw new Error("archive capture returned no receipt")
  return rows[0]
}
