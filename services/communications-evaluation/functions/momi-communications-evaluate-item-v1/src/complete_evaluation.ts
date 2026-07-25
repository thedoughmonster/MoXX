import { getDatabase } from "./database.ts"
import {
  classifierVersion,
  evaluatorKey,
  promptVersion,
  type EvaluationCandidate,
  type EvaluationCompletion,
  type EvaluatedOutput,
} from "./types.ts"

export async function completeEvaluation(
  candidate: EvaluationCandidate,
  evaluated: EvaluatedOutput,
): Promise<EvaluationCompletion | null> {
  const sql = getDatabase()
  const rows = await sql<EvaluationCompletion[]>`
    select completed.evaluation_id::text as evaluation_id,
      completed.derived_count
    from momi_communications.complete_evaluation_job_v1(
      ${candidate.evaluation_job_id}::bigint,
      ${candidate.capability_token}::uuid,
      ${evaluatorKey},
      ${classifierVersion},
      ${evaluated.provider_model},
      ${promptVersion},
      ${sql.json(evaluated.output)}
    ) as completed
  `
  return rows[0] ?? null
}
