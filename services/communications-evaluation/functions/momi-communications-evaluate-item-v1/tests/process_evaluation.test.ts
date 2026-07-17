import assert from "node:assert/strict"
import test from "node:test"
import { processEvaluation } from "../src/process_evaluation.ts"
import type {
  EvaluationCandidate,
  EvaluationInput,
  EvaluationOutput,
  EvaluationStore,
} from "../src/types.ts"

const input: EvaluationInput = {
  evaluation_job_id: "7",
  capability_token: "22222222-2222-4222-8222-222222222222",
}
const candidate: EvaluationCandidate = {
  ...input,
  archive_item_id: "11111111-1111-4111-8111-111111111111",
  source_type: "openai",
  source_account_key: "account-a",
  source_user_key: "user-a",
  source_conversation_key: "conversation-a",
  source_message_key: "message-a",
  sender_role: "assistant",
  occurred_at: "2026-07-17T12:00:00Z",
  source_metadata: {}, payload: {}, raw_text: "A task", attempt_count: 1,
}
const output: EvaluationOutput = {
  decision: "retain", validation: "supported", urgency: "low", impact: "low",
  confidence: 0.9, rationale: "Concrete task", flags: [], merge_suggestions: [],
  derived_records: [],
}

class FakeStore implements EvaluationStore {
  candidate: EvaluationCandidate | null = candidate
  evaluationError = false
  calls: string[] = []

  claim(): Promise<EvaluationCandidate | null> {
    this.calls.push("claim")
    return Promise.resolve(this.candidate)
  }
  evaluate(): Promise<EvaluationOutput> {
    this.calls.push("evaluate")
    return this.evaluationError
      ? Promise.reject(new Error("model unavailable"))
      : Promise.resolve(output)
  }
  complete(): Promise<{ evaluation_id: string; derived_count: number }> {
    this.calls.push("complete")
    return Promise.resolve({ evaluation_id: "9", derived_count: 0 })
  }
  fail(): Promise<boolean> {
    this.calls.push("fail")
    return Promise.resolve(true)
  }
}

test("does not call the model when exact work cannot be claimed", async () => {
  const store = new FakeStore()
  store.candidate = null
  const result = await processEvaluation(input, store)
  assert.equal(result.body.disposition, "duplicate")
  assert.deepEqual(store.calls, ["claim"])
})

test("evaluates and completes one claimed item", async () => {
  const store = new FakeStore()
  const result = await processEvaluation(input, store)
  assert.equal(result.body.disposition, "evaluated")
  assert.equal(result.body.evaluation_id, "9")
  assert.deepEqual(store.calls, ["claim", "evaluate", "complete"])
})

test("persists retry state after a model failure", async () => {
  const store = new FakeStore()
  store.evaluationError = true
  const result = await processEvaluation(input, store)
  assert.equal(result.body.disposition, "retrying")
  assert.deepEqual(store.calls, ["claim", "evaluate", "fail"])
})
