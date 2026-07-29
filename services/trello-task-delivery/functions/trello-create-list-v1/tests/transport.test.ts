// service-owner: trello-task-delivery

import assert from "node:assert/strict"
import test from "node:test"
import { sendCreateList } from "../src/send_create_list.ts"

const operation = {
  operationId: "22222222-2222-4222-8222-222222222222",
  capabilityToken: "fixture-capability",
  operationType: "create_list" as const,
  boardId: "board-1",
  listName: "Blocked",
  listPosition: "bottom" as const,
}

test("sends one marked create without credentials in URL or body", async () => {
  let requestUrl = ""
  let requestInit: RequestInit | undefined
  const fetcher = ((input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input)
    requestInit = init
    return Promise.resolve(new Response('{"id":"list-blocked"}', {
      status: 200,
      headers: {
        "content-type": "application/json",
        authorization: "forbidden-response-header",
      },
    }))
  }) as typeof fetch
  const result = await sendCreateList(
    operation,
    "fixture-api-key",
    "fixture-api-token",
    "momi:kitchen:operation-1",
    fetcher,
  )

  const url = new URL(requestUrl)
  assert.equal(`${url.origin}${url.pathname}`, "https://api.trello.com/1/lists")
  assert.equal(url.searchParams.get("name"), "Blocked")
  assert.equal(url.searchParams.get("idBoard"), "board-1")
  assert.equal(url.searchParams.get("pos"), "bottom")
  assert.equal(requestUrl.includes("fixture-api"), false)
  const headers = new Headers(requestInit?.headers)
  assert.equal(headers.get("x-trello-client-identifier"), "momi:kitchen:operation-1")
  assert.match(headers.get("authorization") ?? "", /^OAuth /)
  assert.equal(requestInit?.body, undefined)
  assert.equal(result.httpStatus, 200)
  assert.deepEqual(result.payload, { id: "list-blocked" })
  assert.equal(JSON.stringify(result).includes("forbidden-response-header"), false)
})

test("returns an ambiguous network result for durable recording", async () => {
  const fetcher = (() => Promise.reject(new Error("fixture network detail"))) as typeof fetch
  const result = await sendCreateList(
    operation,
    "fixture-api-key",
    "fixture-api-token",
    "momi:kitchen:operation-1",
    fetcher,
  )

  assert.equal(result.httpStatus, null)
  assert.equal(result.errorCode, "trello_network_error")
})
