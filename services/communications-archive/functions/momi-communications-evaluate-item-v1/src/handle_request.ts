import { buildHealthResponse } from "./build_health_response.ts"
import { evaluatorStore } from "./evaluator_store.ts"
import { isEvaluatorConfigured } from "./is_evaluator_configured.ts"
import { parseEvaluationInput } from "./parse_request.ts"
import { processEvaluation } from "./process_evaluation.ts"
import { functionKey } from "./types.ts"

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return buildHealthResponse(isEvaluatorConfigured())
  }
  if (request.method !== "POST") {
    return new Response("method not allowed", {
      status: 405, headers: { Allow: "GET, POST" },
    })
  }
  const body: unknown = await request.json().catch(() => null)
  const input = parseEvaluationInput(body)
  if (!input) {
    return Response.json({ ok: false, function_key: functionKey,
      evaluation_job_id: "0", disposition: "invalid_request" }, { status: 400 })
  }
  try {
    const result = await processEvaluation(input, evaluatorStore)
    return Response.json(result.body, { status: result.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : "claim failed"
    console.error("Evaluation claim failed", input.evaluation_job_id, message)
    return Response.json({ ok: false, function_key: functionKey,
      evaluation_job_id: input.evaluation_job_id, disposition: "retrying" },
    { status: 503 })
  }
}
