import type { EvaluationInput } from "./types.ts"

const jobPattern = /^[1-9][0-9]*$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseEvaluationInput(value: unknown): EvaluationInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const keys = Object.keys(input)
  if (keys.length !== 2 || !keys.includes("evaluation_job_id") ||
    !keys.includes("capability_token")) return null
  if (typeof input.evaluation_job_id !== "string" ||
    !jobPattern.test(input.evaluation_job_id) ||
    typeof input.capability_token !== "string" ||
    !uuidPattern.test(input.capability_token)) return null
  return {
    evaluation_job_id: input.evaluation_job_id,
    capability_token: input.capability_token,
  }
}
