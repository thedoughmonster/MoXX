import assert from "node:assert/strict"
import test from "node:test"

import { isSecretKeyAuthorization } from "../supabase/functions/toast-order-alert-eligibility-v1/authorize_request.ts"

test("requires the exact default secret key in the apikey header", () => {
  const keys = JSON.stringify({ default: "sb_secret_expected" })

  assert.equal(isSecretKeyAuthorization("sb_secret_expected", keys), true)
  assert.equal(isSecretKeyAuthorization("sb_publishable_other", keys), false)
  assert.equal(isSecretKeyAuthorization(null, keys), false)
  assert.equal(isSecretKeyAuthorization("sb_secret_expected", undefined), false)
  assert.equal(isSecretKeyAuthorization("sb_secret_expected", "not-json"), false)
})
