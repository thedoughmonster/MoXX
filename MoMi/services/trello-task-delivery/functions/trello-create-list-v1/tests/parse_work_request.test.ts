// service-owner: trello-task-delivery

import assert from "node:assert/strict"
import test from "node:test"
import { parseWorkRequest } from "../src/parse_work_request.ts"

const operationId = "22222222-2222-4222-8222-222222222222"

test("accepts only exact capability-bound delivery work", () => {
  assert.deepEqual(parseWorkRequest({
    operation_id: operationId,
    capability_token: "fixture-capability",
  }), { operationId, capabilityToken: "fixture-capability" })
  assert.equal(parseWorkRequest({
    operation_id: operationId,
    capability_token: "fixture-capability",
    list_name: "caller-chosen-list",
  }), null)
})
