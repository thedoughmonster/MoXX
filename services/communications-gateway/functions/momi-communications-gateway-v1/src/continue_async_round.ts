import type { JSONValue } from "postgres"
import type { AsyncRound } from "./async_round.ts"
import { getDatabase } from "./database.ts"

export async function continueAsyncRound(current: AsyncRound, next: {
  gateway_call_id: string
  provider_response_id: string
  request_payload: Record<string, JSONValue>
  answer_round: number
  provider_round: number
  evidence_order: number
  provider_model: string
}): Promise<void> {
  const sql = getDatabase()
  const rows = await sql<{ continued: boolean }[]>`
    select momi_communications_gateway.continue_async_round_v1(
      ${current.async_round_id}::uuid, ${current.lease_token}::uuid,
      ${next.gateway_call_id}::uuid, ${next.provider_response_id},
      ${sql.json(next.request_payload)}, ${next.answer_round},
      ${next.provider_round}, ${next.evidence_order}, ${next.provider_model}
    ) as continued
  `
  if (!rows[0]?.continued) throw new Error("async_round_continue_failed")
}
