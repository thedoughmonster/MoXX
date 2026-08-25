// service-owner: trello-evidence-ingestion

import assert from "node:assert/strict"
import test from "node:test"

import { processWebhook } from "../src/process_webhook.ts"
import type {
  EvidenceEnvelope,
  IngestionDependencies,
} from "../src/types.ts"
import {
  actionId,
  actorId,
  boardId,
  callbackUrl,
  cardId,
  fixtureSecret,
  listId,
  signTrelloBody,
  webhookBody,
} from "./fixtures.ts"

test("accepts Trello's HEAD probe without configuration or storage", async () => {
  const dependencies: IngestionDependencies = {
    getSetting() {
      throw new Error("HEAD must not read settings")
    },
    store() {
      throw new Error("HEAD must not store")
    },
  }
  const response = await processWebhook(
    new Request(callbackUrl, { method: "HEAD" }),
    dependencies,
  )

  assert.equal(response.status, 200)
  assert.equal(await response.text(), "")
})

test("archives actor, external references, marker, and complete payload", async () => {
  const stored: EvidenceEnvelope[] = []
  const dependencies: IngestionDependencies = {
    getSetting(name) {
      return name === "TRELLO_WEBHOOK_SECRET" ? fixtureSecret : callbackUrl
    },
    store(envelope) {
      stored.push(envelope)
      return Promise.resolve({
        disposition: "stored",
        archiveItemId: "archive-item-1",
        contentHash: "a".repeat(64),
      })
    },
  }
  const response = await processWebhook(new Request(callbackUrl, {
    method: "POST",
    headers: {
      "X-Trello-Webhook": signTrelloBody(webhookBody),
      "X-Trello-Client-Identifier": "momi:delivery:operation-1",
      Authorization: "Bearer forbidden-authorization-value",
      Cookie: "forbidden-cookie-value",
      apikey: "forbidden-api-key-value",
    },
    body: webhookBody,
  }), dependencies)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, disposition: "stored" })
  assert.equal(stored[0]?.actionId, actionId)
  assert.equal(stored[0]?.actorId, actorId)
  assert.equal(stored[0]?.boardId, boardId)
  assert.equal(stored[0]?.rawBody, webhookBody)
  const metadata = stored[0]?.sourceMetadata
  assert.equal(metadata?.client_identifier, "momi:delivery:operation-1")
  assert.deepEqual(metadata?.external_references, {
    action_id: actionId,
    board_id: boardId,
    webhook_id: "trello-webhook-1",
    action_board_id: boardId,
    card_id: cardId,
    list_id: listId,
  })
  assert.equal(JSON.stringify(stored[0]).includes("forbidden-"), false)
  assert.deepEqual(stored[0]?.payload.sourceField, { preserved: true })
})

test("returns success for replay and rejects invalid signatures", async () => {
  let storeCalls = 0
  const dependencies: IngestionDependencies = {
    getSetting(name) {
      return name === "TRELLO_WEBHOOK_SECRET" ? fixtureSecret : callbackUrl
    },
    store() {
      storeCalls += 1
      return Promise.resolve({
        disposition: "duplicate",
        archiveItemId: "archive-item-1",
        contentHash: "a".repeat(64),
      })
    },
  }
  const replay = await processWebhook(new Request(callbackUrl, {
    method: "POST",
    headers: { "X-Trello-Webhook": signTrelloBody(webhookBody) },
    body: webhookBody,
  }), dependencies)
  const rejected = await processWebhook(new Request(callbackUrl, {
    method: "POST",
    headers: { "X-Trello-Webhook": "invalid" },
    body: webhookBody,
  }), dependencies)

  assert.deepEqual(await replay.json(), { ok: true, disposition: "duplicate" })
  assert.equal(rejected.status, 401)
  assert.equal(storeCalls, 1)
})
