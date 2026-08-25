import { getDatabase } from "./database.ts"
import type { EvaluationInput } from "./types.ts"

export async function failEvaluation(
  input: EvaluationInput,
  code: string,
  message: string,
): Promise<boolean> {
  const sql = getDatabase()
  const rows = await sql<{ failed: boolean }[]>`
    select momi_communications.fail_evaluation_job_v1(
      ${input.evaluation_job_id}::bigint,
      ${input.capability_token}::uuid,
      ${code},
      ${message}
    ) as failed
  `
  return rows[0]?.failed ?? false
}
