import {
  functionKey,
  type EvaluationInput,
  type EvaluationResult,
  type EvaluationStore,
} from "./types.ts"

export async function processEvaluation(
  input: EvaluationInput,
  store: EvaluationStore,
): Promise<EvaluationResult> {
  const candidate = await store.claim(input)
  if (!candidate) {
    return { status: 202, body: { ok: true, function_key: functionKey,
      evaluation_job_id: input.evaluation_job_id, disposition: "duplicate" } }
  }
  try {
    const output = await store.evaluate(candidate)
    const completed = await store.complete(candidate, output)
    if (!completed) {
      return { status: 202, body: { ok: true, function_key: functionKey,
        evaluation_job_id: input.evaluation_job_id, disposition: "duplicate" } }
    }
    return { status: 200, body: { ok: true, function_key: functionKey,
      evaluation_job_id: input.evaluation_job_id, disposition: "evaluated",
      evaluation_id: completed.evaluation_id,
      derived_count: completed.derived_count } }
  } catch (error) {
    const message = error instanceof Error ? error.message : "evaluation failed"
    try {
      await store.fail(input, "evaluation_failed", message)
    } catch (failureError) {
      const failureMessage = failureError instanceof Error
        ? failureError.message
        : "failure persistence failed"
      console.error("Evaluation failure persistence failed",
        input.evaluation_job_id, failureMessage)
    }
    return { status: 503, body: { ok: false, function_key: functionKey,
      evaluation_job_id: input.evaluation_job_id, disposition: "retrying" } }
  }
}
