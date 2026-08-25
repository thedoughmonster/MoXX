import assert from "node:assert/strict"
import test from "node:test"

import { verifyToastSignature } from "../services/toast-order-ingest/functions/toast-orders-webhook-ingest-v1/src/verify_toast_signature.ts"
import { body, secret, timestamp } from "./fixtures.ts"

test("rejects an invalid signature", async () => {
  assert.equal(
    await verifyToastSignature(body, timestamp, "aW52YWxpZA==", secret),
    false,
  )
})
