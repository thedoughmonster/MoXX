import { getDatabase } from "../../momi-model-execution-gateway-v1/src/database.ts"
import type { ClaimedCompletion, CompletionInput } from "./types.ts"

export async function claimCompletion(input: CompletionInput): Promise<ClaimedCompletion | null> {
  const sql = getDatabase()
  const rows = await sql<ClaimedCompletion[]>`
    select work_id::text, capability_token::text, call_id::text, caller_key,
      provider_response_id, event_type, timeout_seconds
    from momi_model_execution.claim_completion_work_v1(
      ${input.work_id}::uuid, ${input.capability_token}::uuid
    )
  `
  return rows[0] ?? null
}
