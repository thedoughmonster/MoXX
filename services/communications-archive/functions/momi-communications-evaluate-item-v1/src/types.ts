export const functionKey = "momi.communications.evaluate_item.v1"
export const evaluatorKey = "momi.communications.model_evaluator.v1"
export const classifierVersion = "momi.communications.classifier.v1"
export const promptVersion = "momi.communications.evaluator_prompt.v1"

export type EvaluationInput = {
  evaluation_job_id: string
  capability_token: string
}

export type EvaluationCandidate = EvaluationInput & {
  archive_item_id: string
  source_type: string
  source_account_key: string
  source_user_key: string
  source_conversation_key: string
  source_message_key: string
  sender_role: string
  occurred_at: string
  source_metadata: Record<string, unknown>
  payload: unknown
  raw_text: string | null
  attempt_count: number
}

export type DerivedCandidate = {
  kind: "task" | "knowledge" | "incident" | "alert" | "other"
  key: string | null
  summary: string
  details: string | null
  work_scope: "software_repository" | "business_operations" | "personal" | "unknown"
  destination_hint: "github_issue" | "clickup" | "none" | "undetermined"
  confidence: number
}

export type EvaluationOutput = {
  decision: "retain" | "archive" | "noise" | "merge_review" | "needs_human_review"
  validation: "supported" | "uncertain" | "conflicted" | "not_verifiable"
  urgency: "none" | "low" | "medium" | "high" | "critical"
  impact: "low" | "medium" | "high"
  confidence: number
  rationale: string
  flags: string[]
  merge_suggestions: string[]
  derived_records: DerivedCandidate[]
}

export type EvaluationCompletion = {
  evaluation_id: string
  derived_count: number
}

export type EvaluationStore = {
  claim: (input: EvaluationInput) => Promise<EvaluationCandidate | null>
  evaluate: (candidate: EvaluationCandidate) => Promise<EvaluationOutput>
  complete: (
    candidate: EvaluationCandidate,
    output: EvaluationOutput,
  ) => Promise<EvaluationCompletion | null>
  fail: (input: EvaluationInput, code: string, message: string) => Promise<boolean>
}

export type EvaluationResult = {
  status: number
  body: {
    ok: boolean
    function_key: typeof functionKey
    evaluation_job_id: string
    disposition: "duplicate" | "evaluated" | "retrying"
    evaluation_id?: string
    derived_count?: number
  }
}
