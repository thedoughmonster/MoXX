import { getDatabase } from "./database.ts"
import type { AsyncRound } from "./async_round.ts"

export async function claimAsyncRound(callId: string,
  responseId: string): Promise<AsyncRound | null> {
  const sql = getDatabase()
  const rows = await sql<AsyncRound[]>`
    select async_round_id::text, lease_token::text, invocation_id::text,
      input_payload, request_payload, route_key, answer_round, provider_round,
      evidence_order, provider_model, archive_receipt_id::text,
      async_deadline::text, maximum_output_tokens
    from momi_communications_gateway.claim_async_round_v1(
      ${callId}::uuid, ${responseId}
    )
  `
  return rows[0] ?? null
}
