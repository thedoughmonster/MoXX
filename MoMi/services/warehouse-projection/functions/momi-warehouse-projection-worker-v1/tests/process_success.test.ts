import assert from "node:assert/strict"
import test from "node:test"
import { processDelivery } from "../src/process_delivery.ts"
import {
  capabilityToken,
  deliveryTriggerFixture,
  eventId,
  FakeStore,
  sourceEventFixture,
} from "./fake_store.ts"

test("projects and acknowledges a successful message", async () => {
  const store = new FakeStore()
  const result = await processDelivery(deliveryTriggerFixture, store)
  assert.equal(result.outcome, "projected")
  assert.deepEqual(store.calls, [
    "begin:1",
    `source:${eventId}`,
    `project:${eventId}`,
    "ack:1",
  ])
  assert.deepEqual(store.lifecycleTokens, [capabilityToken, capabilityToken])
})

test("accepts the explicit stock observation projection result", async () => {
  const store = new FakeStore()
  store.projectionOutcomes.set(eventId, "projected_stock_observation")
  const result = await processDelivery(deliveryTriggerFixture, store)
  assert.equal(result.outcome, "projected_stock_observation")
  assert.equal(store.calls.at(-1), "ack:1")
})

test("accepts menu refresh and unchanged publication outcomes", async () => {
  for (const outcome of ["menu_refresh_enqueued", "publication_not_advanced"]) {
    const store = new FakeStore()
    store.projectionOutcomes.set(eventId, outcome)
    const result = await processDelivery(deliveryTriggerFixture, store)
    assert.equal(result.outcome, outcome)
    assert.equal(store.calls.at(-1), "ack:1")
  }
})

test("acknowledges a duplicate message without projecting again", async () => {
  const store = new FakeStore()
  store.beginOutcomes.set("1", false)
  const result = await processDelivery(deliveryTriggerFixture, store)
  assert.equal(result.outcome, "duplicate")
  assert.deepEqual(store.calls, ["begin:1"])
})

test("acks an unknown valid category only for an explicit ignored result", async () => {
  const store = new FakeStore()
  store.sourceEvents.set(eventId, {
    ...sourceEventFixture,
    event_name: "source.toast.resource.future_category.observed",
  })
  store.projectionOutcomes.set(eventId, "ignored_raw_resource_pending_mapper")
  const result = await processDelivery(deliveryTriggerFixture, store)
  assert.equal(result.outcome, "ignored_raw_resource_pending_mapper")
  assert.equal(store.calls.at(-1), "ack:1")
})

test("leaves continuation outside the exact delivery transaction", async () => {
  const store = new FakeStore()
  const result = await processDelivery(deliveryTriggerFixture, store)
  assert.equal(result.outcome, "projected")
  assert.equal(store.calls.includes("reserve:next"), false)
})
