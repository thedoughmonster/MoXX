// service-owner: trello-task-delivery

import assert from "node:assert/strict"
import test from "node:test"
import { processDelivery } from "../src/process_delivery.ts"
import type { DeliveryDependencies } from "../src/types.ts"

const operationId = "44444444-4444-4444-8444-444444444444"

test("uses durable webhook work and an operation-bound marker", async () => {
  let deliveredMarker = ""
  const dependencies: DeliveryDependencies = {
    getSetting(name) {
      if (name === "TRELLO_API_KEY") return "fixture-key"
      if (name === "TRELLO_API_TOKEN") return "fixture-token"
      return "momi:kitchen"
    },
    claim: (work) => Promise.resolve({
      ...work,
      operationType: "register_webhook",
      boardId: "board-1",
      callbackUrl: "https://example.test/webhook",
      description: "MoMi Kitchen Operations",
      inventoryJobId: "55555555-5555-4555-8555-555555555555",
      inventoryCompletedAt: "2026-07-29T13:00:00.000Z",
      callbackHeadEvidenceRef: "head:callback:fixture",
      callbackHeadVerifiedAt: "2026-07-29T13:01:00.000Z",
      callbackHeadHttpStatus: 200,
    }),
    deliver(_operation, _key, _token, marker) {
      deliveredMarker = marker
      return Promise.resolve({
        finalStatus: "succeeded", httpStatus: 200, headers: {},
        payload: [], rawText: "[]", errorCode: null,
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

test("does not register for unavailable durable work", async () => {
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
