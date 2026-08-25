import assert from "node:assert/strict"
import test from "node:test"

import { parseRoutingInput } from "../src/parse_request.ts"

const eventId = "11111111-1111-4111-8111-111111111111"
const token = "22222222-2222-4222-8222-222222222222"

test("accepts only an event identity and capability token", () => {
  assert.deepEqual(parseRoutingInput({ event_id: eventId,
    capability_token: token }), { event_id: eventId, capability_token: token })
  assert.equal(parseRoutingInput({ event_id: eventId,
    capability_token: token, payload: {} }), null)
})

test("rejects malformed durable identities", () => {
  assert.equal(parseRoutingInput({ event_id: "1", capability_token: token }), null)
  assert.equal(parseRoutingInput({ event_id: eventId, capability_token: "x" }), null)
})
