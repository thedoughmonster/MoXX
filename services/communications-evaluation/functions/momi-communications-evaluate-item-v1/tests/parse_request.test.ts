import assert from "node:assert/strict"
import test from "node:test"
import { parseEvaluationInput } from "../src/parse_request.ts"

const token = "22222222-2222-4222-8222-222222222222"

test("accepts only one exact evaluator work envelope", () => {
  assert.deepEqual(parseEvaluationInput({
    evaluation_job_id: "42",
    capability_token: token,
  }), {
    evaluation_job_id: "42",
    capability_token: token,
  })
  assert.equal(parseEvaluationInput({
    evaluation_job_id: "42",
    capability_token: token,
    payload: { hidden: true },
  }), null)
  assert.equal(parseEvaluationInput({
    evaluation_job_id: 42,
    capability_token: token,
  }), null)
  assert.equal(parseEvaluationInput({
    evaluation_job_id: "42",
    capability_token: "not-a-token",
  }), null)
})
