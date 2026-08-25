// service-owner: trello-data-acquisition

import assert from "node:assert/strict"
import test from "node:test"
import { parseWorkRequest } from "../src/parse_work_request.ts"

const jobId = "55555555-5555-4555-8555-555555555555"

test("accepts only exact capability-bound inventory work", () => {
  assert.deepEqual(parseWorkRequest({
    job_id: jobId,
    capability_token: "fixture-capability",
  }), { jobId, capabilityToken: "fixture-capability" })
  assert.equal(parseWorkRequest({
    job_id: jobId,
    capability_token: "fixture-capability",
    board_id: "caller-chosen-board",
  }), null)
})
