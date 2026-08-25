import { getDatabase } from "./database.ts"
import type { EvaluationCandidate, EvaluationInput } from "./types.ts"

export async function claimEvaluation(
  input: EvaluationInput,
): Promise<EvaluationCandidate | null> {
  const sql = getDatabase()
  const rows = await sql<EvaluationCandidate[]>`
    select claimed.evaluation_job_id,
      claimed.capability_token::text as capability_token,
      claimed.archive_item_id::text as archive_item_id,
      claimed.source_type, claimed.source_account_key,
      claimed.source_user_key, claimed.source_conversation_key,
      claimed.source_message_key, claimed.sender_role,
      claimed.occurred_at::text as occurred_at,
      claimed.source_metadata, claimed.payload, claimed.raw_text,
      claimed.attempt_count
    from momi_communications.claim_evaluation_job_v1(
      ${input.evaluation_job_id}::bigint,
      ${input.capability_token}::uuid
    ) as claimed
  `
  return rows[0] ?? null
}
