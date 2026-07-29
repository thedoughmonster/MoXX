// service-owner: trello-data-acquisition

import assert from "node:assert/strict"
import test from "node:test"
import { acquireBoardSnapshot } from "../src/acquire_board_snapshot.ts"

test("reads one allowlisted board with header-only credentials", async () => {
  let requestUrl = ""
  let requestInit: RequestInit | undefined
  const fetcher = ((input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input)
    requestInit = init
    return Promise.resolve(new Response(JSON.stringify({
      id: "board-1",
      name: "Kitchen Operations",
      lists: [],
      cards: [],
    }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        authorization: "forbidden-response-header",
      },
    }))
  }) as typeof fetch
  const result = await acquireBoardSnapshot({
    jobId: "11111111-1111-4111-8111-111111111111",
    capabilityToken: "fixture-capability",
    boardLocator: "qdzZg93X",
  }, "fixture-api-key", "fixture-api-token", fetcher)

  assert.match(requestUrl, /^https:\/\/api\.trello\.com\/1\/boards\/qdzZg93X\?/)
  assert.equal(requestUrl.includes("fixture-api"), false)
  assert.equal(new Headers(requestInit?.headers).get("authorization"),
    'OAuth oauth_consumer_key="fixture-api-key", oauth_token="fixture-api-token"')
  assert.equal(result.httpStatus, 200)
  assert.equal(result.rawText?.includes("Kitchen Operations"), true)
  assert.deepEqual(result.headers, { "content-type": "application/json" })
  assert.equal(JSON.stringify(result).includes("forbidden-response-header"), false)
})

test("records a bounded network failure without throwing", async () => {
  const fetcher = (() => Promise.reject(new Error("fixture network detail"))) as typeof fetch
  const result = await acquireBoardSnapshot({
    jobId: "11111111-1111-4111-8111-111111111111",
    capabilityToken: "fixture-capability",
    boardLocator: "qdzZg93X",
  }, "fixture-api-key", "fixture-api-token", fetcher)

  assert.deepEqual(result, {
    httpStatus: null,
    headers: {},
    payload: null,
    rawText: null,
    errorCode: "trello_network_error",
  })
})
