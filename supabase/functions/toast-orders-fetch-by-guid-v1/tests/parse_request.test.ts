import assert from "node:assert/strict"
import test from "node:test"

import { parseJobId } from "../parse_request.ts"

test("accepts only one positive durable job id", () => {
  assert.equal(parseJobId({ job_id: 42 }), "42")
  assert.equal(parseJobId({ job_id: "9223372036854775807" }), "9223372036854775807")
  assert.equal(parseJobId({ job_id: "0" }), null)
  assert.equal(parseJobId({ job_id: "9223372036854775808" }), null)
  assert.equal(parseJobId({ job_id: "1", extra: true }), null)
  assert.equal(parseJobId([]), null)
})
