import assert from "node:assert/strict"
import test from "node:test"
import { processDelivery } from "../src/process_delivery.ts"
import {
  capabilityToken,
  deliveryTriggerFixture,
  eventId,
  FakeStore,
} from "./fake_store.ts"

test("fails a mismatched source event through the exact lifecycle", async () => {
  const store = new FakeStore()
  store.sourceEvents.set(eventId, null)
  const result = await processDelivery(deliveryTriggerFixture, store)
  assert.equal(result.outcome, "retry_wait")
  assert.equal(result.error, "source_event_not_found")
  assert.deepEqual(store.calls, ["begin:1", `source:${eventId}`, "fail:1"])
  assert.deepEqual(store.lifecycleTokens, [capabilityToken, capabilityToken])
})

test("returns the durable retry result after projection failure", async () => {
  const store = new FakeStore()
  store.projectionOutcomes.set(eventId, new Error("database unavailable"))
  const result = await processDelivery(deliveryTriggerFixture, store)
  assert.equal(result.outcome, "retry_wait")
  assert.equal(result.error, "projection_failed")
  assert.equal(store.calls.at(-1), "fail:1")
  assert.match(store.failureErrors[0], /database unavailable/)
})

test("returns the durable dead-letter result at the retry limit", async () => {
  const store = new FakeStore()
  store.projectionOutcomes.set(eventId, new Error("projection rejected"))
  store.failureOutcomes.set("1", "dead_letter")
  const result = await processDelivery(deliveryTriggerFixture, store)
  assert.equal(result.outcome, "dead_letter")
  assert.equal(store.calls.at(-1), "fail:1")
})

test("does not ack an unrecognized projector outcome", async () => {
  const store = new FakeStore()
  store.projectionOutcomes.set(eventId, "unsupported_category")
  const result = await processDelivery(deliveryTriggerFixture, store)
  assert.equal(result.outcome, "retry_wait")
  assert.equal(result.error, "unexpected_projection_outcome")
  assert.equal(store.calls.includes("ack:1"), false)
})
