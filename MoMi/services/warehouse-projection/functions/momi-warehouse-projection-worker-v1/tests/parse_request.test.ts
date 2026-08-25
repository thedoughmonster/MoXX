import assert from "node:assert/strict"
import test from "node:test"
import { parseDeliveryTrigger } from "../src/parse_request.ts"
import { deliveryTriggerFixture } from "./fake_store.ts"

test("accepts one exact delivery identity and capability", () => {
  assert.deepEqual(
    parseDeliveryTrigger(deliveryTriggerFixture),
    deliveryTriggerFixture,
  )
})

test("rejects incomplete, malformed, or widened delivery triggers", () => {
  assert.equal(parseDeliveryTrigger({
    ...deliveryTriggerFixture, message_id: "0",
  }), null)
  assert.equal(parseDeliveryTrigger({
    ...deliveryTriggerFixture, capability_token: "shared-secret",
  }), null)
  assert.equal(parseDeliveryTrigger({
    ...deliveryTriggerFixture, queue: "warehouse_projection_toast_v1",
  }), null)
  assert.equal(parseDeliveryTrigger({
    event_id: deliveryTriggerFixture.event_id,
    capability_token: deliveryTriggerFixture.capability_token,
  }), null)
})
