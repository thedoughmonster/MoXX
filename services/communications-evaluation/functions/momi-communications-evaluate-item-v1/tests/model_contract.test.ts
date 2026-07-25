import assert from "node:assert/strict"
import test from "node:test"
import { buildOpenAiRequest } from "../src/build_openai_request.ts"
import { extractOpenAiOutputText } from "../src/extract_openai_output_text.ts"
import { parseEvaluationOutput } from "../src/parse_evaluation_output.ts"
import type { EvaluationCandidate, EvaluationOutput } from "../src/types.ts"

const candidate: EvaluationCandidate = {
  evaluation_job_id: "7",
  capability_token: "22222222-2222-4222-8222-222222222222",
  archive_item_id: "11111111-1111-4111-8111-111111111111",
  source_type: "openai",
  source_account_key: "account-a",
  source_user_key: "user-a",
  source_conversation_key: "conversation-a",
  source_message_key: "message-a",
  sender_role: "assistant",
  occurred_at: "2026-07-17T12:00:00Z",
  source_metadata: {},
  payload: { note_type: "task", summary: "Review the order import." },
  raw_text: "Review the order import.",
  attempt_count: 1,
}

const output: EvaluationOutput = {
  decision: "retain",
  validation: "supported",
  urgency: "medium",
  impact: "medium",
  confidence: 0.9,
  rationale: "The note contains a concrete follow-up.",
  flags: ["missing_due_date"],
  merge_suggestions: [],
  derived_records: [{
    kind: "task",
    key: "review-order-import",
    summary: "Review the order import",
    details: null,
    work_scope: "software_repository",
    destination_hint: "github_issue",
    confidence: 0.9,
  }],
}

test("builds a strict provider-neutral evaluation request", () => {
  const request = buildOpenAiRequest(candidate)
  assert.equal(request.model, undefined)
  assert.equal(request.store, undefined)
  assert.equal((request.text as Record<string, unknown>).format !== undefined, true)
  assert.equal(JSON.stringify(request).includes(candidate.capability_token), false)
})

test("extracts and validates strict evaluator output", () => {
  const text = JSON.stringify(output)
  const extracted = extractOpenAiOutputText({ output: [{
    type: "message",
    content: [{ type: "output_text", text }],
  }] })
  assert.equal(extracted, text)
  assert.deepEqual(parseEvaluationOutput(JSON.parse(text)), output)
  assert.equal(parseEvaluationOutput({ ...output, confidence: 2 }), null)
  assert.equal(parseEvaluationOutput({ ...output, extra: true }), null)
})
