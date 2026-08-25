// service-owner: trello-evidence-ingestion

import assert from "node:assert/strict"
import test from "node:test"

import { verifyTrelloSignature } from "../src/verify_trello_signature.ts"
import {
  callbackUrl,
  fixtureSecret,
  signTrelloBody,
  webhookBody,
} from "./fixtures.ts"

test("verifies the exact raw body and configured callback URL", async () => {
  const signature = signTrelloBody(webhookBody)

  assert.equal(
    await verifyTrelloSignature(
      webhookBody,
      callbackUrl,
      signature,
      fixtureSecret,
    ),
    true,
  )
  assert.equal(
    await verifyTrelloSignature(
      `${webhookBody}\n`,
      callbackUrl,
      signature,
      fixtureSecret,
    ),
    false,
  )
  assert.equal(
    await verifyTrelloSignature(
      webhookBody,
      `${callbackUrl}/changed`,
      signature,
      fixtureSecret,
    ),
    false,
  )
})

test("rejects malformed signature input", async () => {
  assert.equal(
    await verifyTrelloSignature(
      webhookBody,
      callbackUrl,
      "not base64!",
      fixtureSecret,
    ),
    false,
  )
})
