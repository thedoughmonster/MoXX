// service-owner: trello-data-acquisition

import assert from "node:assert/strict"
import test from "node:test"
import { acquireWebhookInventory } from "../src/acquire_webhook_inventory.ts"

const job = {
  jobId: "55555555-5555-4555-8555-555555555555",
  capabilityToken: "fixture-capability",
  boardId: "board-1",
}

test("reads the exact allowlisted token webhook inventory route", async () => {
  let requestUrl = ""
  let requestInit: RequestInit | undefined
  const fetcher = ((input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input)
    requestInit = init
    return Promise.resolve(new Response('[{"id":"hook-1"}]', {
      status: 200,
      headers: {
        "content-type": "application/json",
        authorization: "forbidden-response-header",
      },
    }))
  }) as typeof fetch
  const result = await acquireWebhookInventory(
    job, "fixture-api-key", "fixture-api-token", fetcher,
  )

  assert.equal(
    requestUrl,
    "https://api.trello.com/1/tokens/fixture-api-token/webhooks",
  )
  assert.equal(new Headers(requestInit?.headers).get("authorization"),
    'OAuth oauth_consumer_key="fixture-api-key", oauth_token="fixture-api-token"')
  assert.equal(result.httpStatus, 200)
  assert.equal(result.rawText, '[{"id":"hook-1"}]')
  assert.equal(JSON.stringify(result).includes("forbidden-response-header"), false)
})

test("records a bounded network failure without throwing", async () => {
  const fetcher = (() => Promise.reject(new Error("fixture network detail"))) as typeof fetch
  const result = await acquireWebhookInventory(
    job, "fixture-api-key", "fixture-api-token", fetcher,
  )

  assert.deepEqual(result, {
    httpStatus: null,
    headers: {},
    payload: null,
    rawText: null,
    errorCode: "trello_network_error",
  })
})
