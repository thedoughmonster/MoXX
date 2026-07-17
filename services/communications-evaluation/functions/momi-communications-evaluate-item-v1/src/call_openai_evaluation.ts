import { buildOpenAiRequest } from "./build_openai_request.ts"
import { extractOpenAiOutputText } from "./extract_openai_output_text.ts"
import { parseEvaluationOutput } from "./parse_evaluation_output.ts"
import type { EvaluationCandidate, EvaluationOutput } from "./types.ts"

export async function callOpenAiEvaluation(
  candidate: EvaluationCandidate,
  fetchImpl: typeof fetch = fetch,
): Promise<EvaluationOutput> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim()
  const model = Deno.env.get("MOMI_COMMUNICATIONS_EVALUATOR_MODEL")?.trim()
  if (!apiKey || !model) throw new Error("Evaluator model configuration is missing")
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildOpenAiRequest(candidate, model)),
  })
  if (!response.ok) {
    throw new Error(`OpenAI Responses API returned ${response.status}`)
  }
  const responseBody: unknown = await response.json()
  const outputText = extractOpenAiOutputText(responseBody)
  if (!outputText) throw new Error("OpenAI response contained no output text")
  let parsed: unknown
  try {
    parsed = JSON.parse(outputText)
  } catch {
    throw new Error("OpenAI response was not valid JSON")
  }
  const output = parseEvaluationOutput(parsed)
  if (!output) throw new Error("OpenAI response violated the evaluation contract")
  return output
}
