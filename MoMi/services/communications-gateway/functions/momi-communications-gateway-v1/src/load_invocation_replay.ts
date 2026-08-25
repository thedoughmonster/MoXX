import { getDatabase } from "./database.ts"
import type { ChatInput, InvocationReplay } from "./types.ts"

export async function loadInvocationReplay(
  input: ChatInput,
  invocationId: string,
  requestHash: string,
): Promise<InvocationReplay> {
  const sql = getDatabase()
  const rows = await sql<InvocationReplay[]>`
    select invocation_status, error_code, terminal_response, provider_calls
    from momi_communications_gateway.get_invocation_replay_v1(
      ${invocationId}::uuid, ${input.user.id}::uuid, ${input.conversation_id},
      ${input.turn_id}, ${requestHash}
    )
  `
  if (!rows[0]) throw new Error("invocation_replay_unavailable")
  return rows[0]
}
