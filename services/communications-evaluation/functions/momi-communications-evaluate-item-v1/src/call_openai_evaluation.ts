import { buildOpenAiRequest } from "./build_openai_request.ts"
import { extractOpenAiOutputText } from "./extract_openai_output_text.ts"
import { parseEvaluationOutput } from "./parse_evaluation_output.ts"
import type { EvaluatedOutput, EvaluationCandidate } from "./types.ts"

export async function callOpenAiEvaluation(
  candidate: EvaluationCandidate,
  fetchImpl: typeof fetch = fetch,
): Promise<EvaluatedOutput> {
  const endpoint = Deno.env.get("MOMI_MODEL_EXECUTION_GATEWAY_URL")?.trim()
  const secret = Deno.env.get("MOMI_MODEL_GATEWAY_EVALUATION_SECRET")?.trim()
  if (!endpoint || !secret) throw new Error("Evaluator gateway configuration is missing")
  const response = await fetchImpl(endpoint, { method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ schema_version: 1, operation: "create",
      purpose_key: "communications.evaluation", profile_key: "default",
      parent_invocation_id: candidate.evaluation_job_id,
      idempotency_key: `evaluation:${candidate.evaluation_job_id}`,
      deadline_at: new Date(Date.now() + 120_000).toISOString(),
      requested_output_tokens: 4000, background: false,
      payload: buildOpenAiRequest(candidate) }),
    signal: AbortSignal.timeout(120_000) })
  const value: unknown = await response.json()
  if (!response.ok || !value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Model gateway returned ${response.status}`)
  }
  const result = value as Record<string, unknown>
  if (result.ok !== true || !result.body || typeof result.body !== "object" ||
      Array.isArray(result.body) || typeof result.provider_model !== "string") {
    throw new Error("Model gateway evaluation failed")
  }
  const outputText = extractOpenAiOutputText(result.body)
  if (!outputText) throw new Error("OpenAI response contained no output text")
  let parsed: unknown
  try { parsed = JSON.parse(outputText) } catch {
    throw new Error("OpenAI response was not valid JSON")
  }
  const output = parseEvaluationOutput(parsed)
  if (!output) throw new Error("OpenAI response violated the evaluation contract")
  return { output, provider_model: result.provider_model }
}
