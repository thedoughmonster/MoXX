import { getDatabase } from "./database.ts"
import type { Admission, ChatInput } from "./types.ts"

export async function admitInvocation(
  input: ChatInput,
  requestHash: string,
  providerPayloadTokens: number,
): Promise<Admission> {
  const sql = getDatabase()
  const rows = await sql<Admission[]>`
    select disposition, invocation_id::text, provider_key, provider_model,
      provider_endpoint, maximum_output_tokens, maximum_input_tokens,
      timeout_seconds, maximum_attempt_cost_micros::text,
      invocation_deadline::text, invocation_status, error_code
    from momi_communications_gateway.admit_invocation_v1(
      ${input.user.id}::uuid, ${input.user.email}, ${input.conversation_id},
      ${input.turn_id}, ${input.model}, ${input.idempotency_key},
      ${requestHash}, ${providerPayloadTokens}
    )
  `
  if (!rows[0]) throw new Error("gateway admission returned no result")
  return rows[0]
}
