// service-owner: trello-task-delivery

import assert from "node:assert/strict"
import test from "node:test"
import { parseWorkRequest } from "../src/parse_work_request.ts"

const operationId = "33333333-3333-4333-8333-333333333333"

test("accepts only exact capability-bound card move work", () => {
  assert.deepEqual(parseWorkRequest({
    operation_id: operationId,
    capability_token: "fixture-capability",
  }), { operationId, capabilityToken: "fixture-capability" })
  assert.equal(parseWorkRequest({
    operation_id: operationId,
    capability_token: "fixture-capability",
    target_list_id: "caller-chosen-list",
  }), null)
})
