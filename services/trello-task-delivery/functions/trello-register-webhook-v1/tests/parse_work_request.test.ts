// service-owner: trello-task-delivery

import assert from "node:assert/strict"
import test from "node:test"
import { parseWorkRequest } from "../src/parse_work_request.ts"

const operationId = "44444444-4444-4444-8444-444444444444"

test("accepts only exact capability-bound webhook work", () => {
  assert.deepEqual(parseWorkRequest({
    operation_id: operationId,
    capability_token: "fixture-capability",
  }), { operationId, capabilityToken: "fixture-capability" })
  assert.equal(parseWorkRequest({
    operation_id: operationId,
    capability_token: "fixture-capability",
    callback_url: "https://caller.example/webhook",
  }), null)
})
