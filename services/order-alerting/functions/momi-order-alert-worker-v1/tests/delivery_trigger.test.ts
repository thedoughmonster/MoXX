import assert from "node:assert/strict"
import test from "node:test"

import { parseDeliveryTrigger } from "../src/parse_delivery_trigger.ts"

const trigger = {
  event_id: "aeb85053-7aef-4f6d-8b74-e4643b588157",
  message_id: "41",
  capability_token: "4a56f5d8-bce2-4a99-8e79-dd994bf7ea65",
}

test("accepts only one exact per-delivery capability trigger", () => {
  assert.deepEqual(parseDeliveryTrigger(trigger), trigger)
  for (const invalid of [
    { ...trigger, message_id: 41 },
    { ...trigger, message_id: "0" },
    { ...trigger, message_id: "9223372036854775808" },
    { ...trigger, capability_token: "shared-secret" },
    { ...trigger, unexpected: true },
    { event_id: trigger.event_id, message_id: trigger.message_id },
  ]) assert.equal(parseDeliveryTrigger(invalid), null)
})
