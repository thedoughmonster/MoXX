// service-owner: trello-data-acquisition

import assert from "node:assert/strict"
import test from "node:test"
import { parseWorkRequest } from "../src/parse_work_request.ts"

const jobId = "11111111-1111-4111-8111-111111111111"

test("accepts only exact capability-bound snapshot work", () => {
  assert.deepEqual(parseWorkRequest({
    job_id: jobId,
    capability_token: "fixture-capability",
  }), { jobId, capabilityToken: "fixture-capability" })
  assert.equal(parseWorkRequest({
    job_id: jobId,
    capability_token: "fixture-capability",
    board_id: "caller-chosen-board",
  }), null)
  assert.equal(parseWorkRequest({
    job_id: "not-a-uuid",
    capability_token: "fixture-capability",
  }), null)
})
