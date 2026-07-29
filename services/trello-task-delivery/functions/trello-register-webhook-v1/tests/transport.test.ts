// service-owner: trello-task-delivery

import assert from "node:assert/strict"
import test from "node:test"
import { sendRegisterWebhook } from "../src/send_register_webhook.ts"

const operation = {
  operationId: "44444444-4444-4444-8444-444444444444",
  capabilityToken: "fixture-capability",
  operationType: "register_webhook" as const,
  boardId: "board-1",
  callbackUrl: "https://example.test/webhook",
  description: "MoMi Kitchen Operations",
  inventoryJobId: "55555555-5555-4555-8555-555555555555",
  inventoryCompletedAt: "2026-07-29T13:00:00.000Z",
  callbackHeadEvidenceRef: "head:callback:fixture",
  callbackHeadVerifiedAt: "2026-07-29T13:01:00.000Z",
  callbackHeadHttpStatus: 200 as const,
}

test("sends exactly one marked prepared webhook registration", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const fetcher = ((input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), init })
    return Promise.resolve(new Response(JSON.stringify({
      id: "hook-1", idModel: "board-1",
      callbackURL: operation.callbackUrl, active: true,
    }), { status: 200 }))
  }) as typeof fetch
  const result = await sendRegisterWebhook(
    operation, "fixture-key", "fixture-token", "momi:kitchen:operation-1", fetcher,
  )

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, "https://api.trello.com/1/webhooks")
  assert.equal(requests[0].url.includes("fixture-token"), false)
  assert.equal(
    new Headers(requests[0].init?.headers).get("x-trello-client-identifier"),
    "momi:kitchen:operation-1",
  )
  assert.equal(result.finalStatus, "succeeded")
  assert.equal(result.errorCode, null)
})

test("marks an uncertain create outcome ambiguous", async () => {
  const fetcher = (() => Promise.reject(new Error("network"))) as typeof fetch
  const result = await sendRegisterWebhook(
    operation, "fixture-key", "fixture-token", "momi:kitchen:operation-1", fetcher,
  )

  assert.equal(result.finalStatus, "ambiguous")
  assert.equal(result.errorCode, "trello_network_error")
})

test("separates client rejection from an unprovable success", async () => {
  const clientError = (() => Promise.resolve(new Response("invalid", {
    status: 400,
  }))) as typeof fetch
  const invalidSuccess = (() => Promise.resolve(new Response(JSON.stringify({
    id: "hook-1",
    idModel: "another-board",
    callbackURL: operation.callbackUrl,
    active: true,
  }), { status: 200 }))) as typeof fetch

  const rejected = await sendRegisterWebhook(
    operation, "fixture-key", "fixture-token", "momi:kitchen:operation-1", clientError,
  )
  const uncertain = await sendRegisterWebhook(
    operation, "fixture-key", "fixture-token", "momi:kitchen:operation-1", invalidSuccess,
  )

  assert.equal(rejected.finalStatus, "failed")
  assert.equal(rejected.errorCode, "trello_http_error")
  assert.equal(uncertain.finalStatus, "ambiguous")
  assert.equal(uncertain.errorCode, "trello_response_invalid")
})
