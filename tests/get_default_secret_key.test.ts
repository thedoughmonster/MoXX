import assert from "node:assert/strict"
import test from "node:test"

import { getDefaultSecretKey } from "../supabase/functions/toast-orders-webhook-ingest-v1/get_default_secret_key.ts"

test("reads only a valid default Supabase secret key", () => {
  assert.equal(
    getDefaultSecretKey(JSON.stringify({ default: "sb_secret_expected" })),
    "sb_secret_expected",
  )
  assert.equal(getDefaultSecretKey(JSON.stringify({ default: 42 })), null)
  assert.equal(getDefaultSecretKey(JSON.stringify({ other: "sb_secret_other" })), null)
  assert.equal(getDefaultSecretKey(JSON.stringify({ default: "legacy-key" })), null)
  assert.equal(getDefaultSecretKey("not-json"), null)
  assert.equal(getDefaultSecretKey(undefined), null)
})
