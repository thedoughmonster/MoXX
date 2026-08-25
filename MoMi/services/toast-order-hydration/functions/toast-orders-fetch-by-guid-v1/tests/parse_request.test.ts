import assert from "node:assert/strict"
import test from "node:test"

import { parseHydrationTrigger } from "../src/parse_request.ts"

test("accepts only a positive job id with its durable token", () => {
  const token = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  assert.deepEqual(parseHydrationTrigger({ job_id: 42, trigger_token: token }), {
    job_id: "42",
    trigger_token: token,
  })
  assert.equal(parseHydrationTrigger({ job_id: "0", trigger_token: token }), null)
  assert.equal(parseHydrationTrigger({ job_id: "1", trigger_token: "bad" }), null)
  assert.equal(
    parseHydrationTrigger({ job_id: "1", trigger_token: token, extra: true }),
    null,
  )
  assert.equal(parseHydrationTrigger([]), null)
})
