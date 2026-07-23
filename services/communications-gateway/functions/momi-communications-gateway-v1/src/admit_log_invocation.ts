import { getDatabase } from "./database.ts"
import type { ChatInput, LogAdmission } from "./types.ts"

export async function admitLogInvocation(
  input: ChatInput,
  requestHash: string,
): Promise<LogAdmission> {
  const sql = getDatabase()
  const inputTokens = Math.max(1, Math.ceil(JSON.stringify(input).length / 4))
  const rows = await sql<LogAdmission[]>`
    select disposition, invocation_id::text, invocation_status, error_code
    from momi_communications_gateway.admit_log_invocation_v1(
      ${input.user.id}::uuid, ${input.user.email}, ${input.conversation_id},
      ${input.turn_id}, ${input.model}, ${input.idempotency_key},
      ${requestHash}, ${inputTokens}
    )
  `
  if (!rows[0]) throw new Error("log admission returned no result")
  return rows[0]
}
