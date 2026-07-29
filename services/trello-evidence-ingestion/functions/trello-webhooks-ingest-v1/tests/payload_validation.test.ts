// service-owner: trello-evidence-ingestion

import assert from "node:assert/strict"
import test from "node:test"

import { parseTrelloWebhook } from "../src/parse_trello_webhook.ts"
import { webhookBody } from "./fixtures.ts"

test("rejects conflicting actor identity snapshots", () => {
  const payload = JSON.parse(webhookBody) as Record<string, unknown>
  const action = payload.action as Record<string, unknown>
  action.idMemberCreator = "another-member"

  assert.equal(parseTrelloWebhook(JSON.stringify(payload)), null)
})

test("rejects a webhook model that does not match the watched model", () => {
  const payload = JSON.parse(webhookBody) as Record<string, unknown>
  const webhook = payload.webhook as Record<string, unknown>
  webhook.idModel = "another-board"

  assert.equal(parseTrelloWebhook(JSON.stringify(payload)), null)
})
