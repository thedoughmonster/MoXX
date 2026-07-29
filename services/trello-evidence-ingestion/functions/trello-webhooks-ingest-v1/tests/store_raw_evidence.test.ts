// service-owner: trello-evidence-ingestion

import assert from "node:assert/strict"
import test from "node:test"

import { buildEvidenceEnvelope } from "../src/build_evidence_envelope.ts"
import { parseTrelloWebhook } from "../src/parse_trello_webhook.ts"
import { storeRawEvidence } from "../src/store_raw_evidence.ts"
import type { Database } from "../src/types.ts"
import {
  actionId,
  actorId,
  boardId,
  webhookBody,
} from "./fixtures.ts"

test("calls only the archive capture contract with source evidence", async () => {
  let sqlText = ""
  let parameters: unknown[] = []
  const query = (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Record<string, unknown>[]> => {
    sqlText = strings.join("?")
    parameters = values
    return Promise.resolve([{
      disposition: "stored",
      archive_item_id: "archive-item-1",
      content_hash: "a".repeat(64),
    }])
  }
  const database = Object.assign(
    query,
    { json: (value: unknown) => value },
  ) as Database
  const payload = parseTrelloWebhook(webhookBody)
  assert.notEqual(payload, null)
  const envelope = buildEvidenceEnvelope(payload!, webhookBody, null)

  const receipt = await storeRawEvidence(database, envelope)

  assert.equal(
    sqlText.includes("momi_communications.capture_raw_json_evidence_v1"),
    true,
  )
  assert.equal(parameters[0], "trello_webhook")
  assert.equal(parameters[1], boardId)
  assert.equal(parameters[2], actorId)
  assert.equal(parameters[4], actionId)
  assert.equal(parameters[9], webhookBody)
  assert.equal(parameters[10], actionId)
  assert.deepEqual(receipt, {
    disposition: "stored",
    archiveItemId: "archive-item-1",
    contentHash: "a".repeat(64),
  })
})
