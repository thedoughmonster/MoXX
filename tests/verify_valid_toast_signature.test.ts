import assert from "node:assert/strict"
import test from "node:test"

import { verifyToastSignature } from "../supabase/functions/toast-orders-webhook-ingest-v1/verify_toast_signature.ts"
import { body, secret, signature, timestamp } from "./fixtures.ts"

test("accepts a Toast-compatible signature", async () => {
  assert.equal(
    await verifyToastSignature(body, timestamp, signature, secret),
    true,
  )
})
