// service-owner: trello-task-delivery

import assert from "node:assert/strict"
import test from "node:test"
import { sendMoveCard } from "../src/send_move_card.ts"

const operation = {
  operationId: "33333333-3333-4333-8333-333333333333",
  capabilityToken: "fixture-capability",
  operationType: "move_card" as const,
  boardId: "board-1",
  cardId: "card-1",
  targetListId: "list-unassigned",
}

test("sends one marked desired-state card move", async () => {
  let requestUrl = ""
  let requestInit: RequestInit | undefined
  const fetcher = ((input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input)
    requestInit = init
    return Promise.resolve(new Response(
      '{"id":"card-1","idBoard":"board-1","idList":"list-unassigned"}',
      { status: 200, headers: { authorization: "forbidden-response-header" } },
    ))
  }) as typeof fetch
  const result = await sendMoveCard(
    operation,
    "fixture-api-key",
    "fixture-api-token",
    "momi:kitchen:operation-1",
    fetcher,
  )

  assert.equal(requestUrl, "https://api.trello.com/1/cards/card-1")
  assert.equal(requestUrl.includes("fixture-api"), false)
  assert.deepEqual(JSON.parse(String(requestInit?.body)), { idList: "list-unassigned" })
  const headers = new Headers(requestInit?.headers)
  assert.equal(headers.get("x-trello-client-identifier"), "momi:kitchen:operation-1")
  assert.match(headers.get("authorization") ?? "", /^OAuth /)
  assert.equal(result.finalStatus, "succeeded")
  assert.equal(JSON.stringify(result).includes("forbidden-response-header"), false)
})

test("treats an unprovable success response as ambiguous", async () => {
  const fetcher = (() => Promise.resolve(new Response('{"id":"another-card"}', {
    status: 200,
  }))) as typeof fetch
  const result = await sendMoveCard(
    operation,
    "fixture-api-key",
    "fixture-api-token",
    "momi:kitchen:operation-1",
    fetcher,
  )

  assert.equal(result.finalStatus, "ambiguous")
  assert.equal(result.errorCode, "trello_response_invalid")
})
