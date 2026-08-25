import assert from "node:assert/strict"
import test from "node:test"

import { processEventDelivery } from "../src/process_event_delivery.ts"
import type {
  DeliveryTrigger,
  DeliveryWorkerStore,
  StagedEventWork,
} from "../src/delivery_types.ts"

const trigger: DeliveryTrigger = {
  event_id: "aeb85053-7aef-4f6d-8b74-e4643b588157",
  message_id: "41",
  capability_token: "4a56f5d8-bce2-4a99-8e79-dd994bf7ea65",
}

test("acknowledges archived and reconciled orders without alert work", async () => {
  for (const eventName of [
    "warehouse.order.archived",
    "warehouse.order.reconciled",
  ]) {
    let executions = 0
    let acknowledgedToken = ""
    const staged: StagedEventWork = {
      disposition: "ignored_non_live_event",
      event_name: eventName,
      work_id: null,
      trigger_token: null,
      work_status: null,
    }
    const store: DeliveryWorkerStore = {
      beginDelivery: () => Promise.resolve(true),
      stageEventWork: () => Promise.resolve(staged),
      executeWork: () => {
        executions += 1
        return Promise.resolve({ status: 500, body: { ok: false } })
      },
      acknowledgeDelivery: (_event, _message, capability) => {
        acknowledgedToken = capability
        return Promise.resolve(true)
      },
      failDelivery: () => Promise.resolve("retry_wait"),
    }
    const result = await processEventDelivery(trigger, store)
    assert.equal(result.outcome, "ignored_non_live_event")
    assert.equal(executions, 0)
    assert.equal(acknowledgedToken, trigger.capability_token)
  }
})

test("acknowledges succeeded live work without reevaluation", async () => {
  let executions = 0
  const store: DeliveryWorkerStore = {
    beginDelivery: () => Promise.resolve(true),
    stageEventWork: () => Promise.resolve({
      disposition: "ready",
      event_name: "warehouse.order.observed",
      work_id: "52",
      trigger_token: "d086ff54-b38f-4cdb-a5e1-916ccd915210",
      work_status: "succeeded",
    }),
    executeWork: () => {
      executions += 1
      return Promise.resolve({ status: 500, body: { ok: false } })
    },
    acknowledgeDelivery: () => Promise.resolve(true),
    failDelivery: () => Promise.resolve("retry_wait"),
  }
  const result = await processEventDelivery(trigger, store)
  assert.equal(result.outcome, "replay")
  assert.equal(executions, 0)
})
