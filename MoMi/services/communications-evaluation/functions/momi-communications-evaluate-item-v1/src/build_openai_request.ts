import { evaluationTextFormat } from "./evaluation_text_format.ts"
import { evaluatorInstructions } from "./evaluator_prompt.ts"
import type { EvaluationCandidate } from "./types.ts"

const maximumCandidateCharacters = 120_000

export function buildOpenAiRequest(
  candidate: EvaluationCandidate,
): Record<string, unknown> {
  const candidateDocument = JSON.stringify({
    evaluation_job_id: candidate.evaluation_job_id,
    archive_item_id: candidate.archive_item_id,
    source: {
      type: candidate.source_type,
      account_key: candidate.source_account_key,
      user_key: candidate.source_user_key,
      conversation_key: candidate.source_conversation_key,
      message_key: candidate.source_message_key,
      sender_role: candidate.sender_role,
      occurred_at: candidate.occurred_at,
      metadata: candidate.source_metadata,
    },
    content: { raw_text: candidate.raw_text, payload: candidate.payload },
  })
  const truncated = candidateDocument.length > maximumCandidateCharacters
  const input = truncated
    ? candidateDocument.slice(0, maximumCandidateCharacters) + "\n[truncated]"
    : candidateDocument
  return {
    instructions: evaluatorInstructions,
    input,
    text: { format: evaluationTextFormat },
    metadata: {
      evaluation_job_id: candidate.evaluation_job_id,
      archive_item_id: candidate.archive_item_id,
      input_truncated: String(truncated),
    },
  }
}
