import assert from "node:assert/strict"
import test from "node:test"

import { buildEvidenceEnvelope, storeRawEvidence } from
  "../contracts/public/trello.evidence.capture.v1/index.ts"
import { processWebhook } from
  "../contracts/public/trello.webhooks.ingest.v1/index.ts"
import { buildEvidenceEnvelope as evidenceImplementation } from
  "../functions/trello-webhooks-ingest-v1/src/build_evidence_envelope.ts"
import { processWebhook as webhookImplementation } from
  "../functions/trello-webhooks-ingest-v1/src/process_webhook.ts"
import { storeRawEvidence as storageImplementation } from
  "../functions/trello-webhooks-ingest-v1/src/store_raw_evidence.ts"

test("public Trello evidence contracts expose their existing runtimes", () => {
  assert.equal(processWebhook, webhookImplementation)
  assert.equal(buildEvidenceEnvelope, evidenceImplementation)
  assert.equal(storeRawEvidence, storageImplementation)
})
