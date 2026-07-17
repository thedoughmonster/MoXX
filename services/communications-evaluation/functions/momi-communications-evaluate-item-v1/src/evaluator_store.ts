import { callOpenAiEvaluation } from "./call_openai_evaluation.ts"
import { claimEvaluation } from "./claim_evaluation.ts"
import { completeEvaluation } from "./complete_evaluation.ts"
import { failEvaluation } from "./fail_evaluation.ts"
import type { EvaluationStore } from "./types.ts"

export const evaluatorStore: EvaluationStore = {
  claim: claimEvaluation,
  evaluate: callOpenAiEvaluation,
  complete: completeEvaluation,
  fail: failEvaluation,
}
