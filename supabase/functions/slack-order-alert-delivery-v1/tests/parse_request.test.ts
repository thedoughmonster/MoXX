import assert from "node:assert/strict"
import test from "node:test"

import { parseDeliveryTrigger } from "../parse_request.ts"

test("accepts only the strict durable delivery trigger", () => {
  const token = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  assert.deepEqual(parseDeliveryTrigger({ work_id: 42, trigger_token: token }), {
    work_id: "42",
    trigger_token: token,
  })
  assert.deepEqual(
    parseDeliveryTrigger({ work_id: "9223372036854775807", trigger_token: token }),
    { work_id: "9223372036854775807", trigger_token: token },
  )
  assert.equal(parseDeliveryTrigger({ work_id: 0, trigger_token: token }), null)
  assert.equal(parseDeliveryTrigger({ work_id: 1.5, trigger_token: token }), null)
  assert.equal(parseDeliveryTrigger({ work_id: "01", trigger_token: token }), null)
  assert.equal(
    parseDeliveryTrigger({ work_id: "9223372036854775808", trigger_token: token }),
    null,
  )
  assert.equal(parseDeliveryTrigger({ work_id: "1", trigger_token: "bad" }), null)
  assert.equal(parseDeliveryTrigger({ work_id: "1" }), null)
  assert.equal(parseDeliveryTrigger({ trigger_token: token }), null)
  assert.equal(
    parseDeliveryTrigger({ work_id: "1", trigger_token: token, extra: true }),
    null,
  )
  assert.equal(parseDeliveryTrigger(null), null)
  assert.equal(parseDeliveryTrigger(["1", token]), null)
})
