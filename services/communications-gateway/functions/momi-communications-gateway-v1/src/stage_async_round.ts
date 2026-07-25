import type { JSONValue } from "postgres"
import { getDatabase } from "./database.ts"
import type { ChatInput, RouteKey } from "./types.ts"

export async function stageAsyncRound(value: {
  invocation_id: string
  gateway_call_id: string
  provider_response_id: string
  input: ChatInput
  request: Record<string, JSONValue>
  route_key: RouteKey
  answer_round: number
  provider_round: number
  evidence_order: number
  provider_model: string
  archive_receipt_id: string
}): Promise<void> {
  const sql = getDatabase()
  const rows = await sql<{ staged: boolean }[]>`
    select momi_communications_gateway.stage_async_round_v1(
      ${value.invocation_id}::uuid, ${value.gateway_call_id}::uuid,
      ${value.provider_response_id}, ${sql.json(value.input as unknown as JSONValue)},
      ${sql.json(value.request)}, ${value.route_key}, ${value.answer_round},
      ${value.provider_round}, ${value.evidence_order}, ${value.provider_model},
      ${value.archive_receipt_id}::uuid
    ) as staged
  `
  if (!rows[0]?.staged) throw new Error("async_round_stage_failed")
}
