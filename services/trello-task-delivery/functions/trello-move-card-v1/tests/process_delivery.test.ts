// service-owner: trello-task-delivery

import assert from "node:assert/strict"
import test from "node:test"
import { processDelivery } from "../src/process_delivery.ts"
import type { DeliveryDependencies } from "../src/types.ts"

const operationId = "33333333-3333-4333-8333-333333333333"

test("uses the durable card move and operation-bound marker", async () => {
  let deliveredMarker = ""
  const dependencies: DeliveryDependencies = {
    getSetting(name) {
      if (name === "TRELLO_API_KEY") return "fixture-key"
      if (name === "TRELLO_API_TOKEN") return "fixture-token"
      return "momi:kitchen"
    },
    claim: (work) => Promise.resolve({
      ...work,
      operationType: "move_card",
      boardId: "board-1",
      cardId: "card-1",
      targetListId: "list-unassigned",
    }),
    deliver(_operation, _key, _token, marker) {
      deliveredMarker = marker
      return Promise.resolve({
        finalStatus: "succeeded", httpStatus: 200, headers: {},
        payload: { id: "card-1" }, rawText: "{}", errorCode: null,
      })
    },
    finish: () => Promise.resolve("succeeded"),
  }
  const response = await processDelivery(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({
      operation_id: operationId,
      capability_token: "fixture-capability",
    }),
  }), dependencies)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, status: "succeeded" })
  assert.equal(deliveredMarker, `momi:kitchen:${operationId}`)
})

test("does not move a card for unavailable durable work", async () => {
  let deliveryCalls = 0
  const dependencies: DeliveryDependencies = {
    getSetting: () => "configured",
    claim: () => Promise.resolve(null),
    deliver() {
      deliveryCalls += 1
      throw new Error("must not deliver")
    },
    finish: () => Promise.reject(new Error("must not finish")),
  }
  const response = await processDelivery(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({
      operation_id: operationId,
      capability_token: "fixture-capability",
    }),
  }), dependencies)

  assert.equal(response.status, 409)
  assert.equal(deliveryCalls, 0)
})
