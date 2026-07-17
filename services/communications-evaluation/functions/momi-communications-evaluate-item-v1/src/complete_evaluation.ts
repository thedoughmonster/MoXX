import { getDatabase } from "./database.ts"
import {
  classifierVersion,
  evaluatorKey,
  promptVersion,
  type EvaluationCandidate,
  type EvaluationCompletion,
  type EvaluationOutput,
} from "./types.ts"

export async function completeEvaluation(
  candidate: EvaluationCandidate,
  output: EvaluationOutput,
): Promise<EvaluationCompletion | null> {
  const model = Deno.env.get("MOMI_COMMUNICATIONS_EVALUATOR_MODEL")?.trim()
  if (!model) throw new Error("Evaluator model configuration is missing")
  const sql = getDatabase()
  const rows = await sql<EvaluationCompletion[]>`
    select completed.evaluation_id::text as evaluation_id,
      completed.derived_count
    from momi_communications.complete_evaluation_job_v1(
      ${candidate.evaluation_job_id}::bigint,
      ${candidate.capability_token}::uuid,
      ${evaluatorKey},
      ${classifierVersion},
      ${model},
      ${promptVersion},
      ${sql.json(output)}
    ) as completed
  `
  return rows[0] ?? null
}
