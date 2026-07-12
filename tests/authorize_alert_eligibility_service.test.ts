import assert from "node:assert/strict"
import test from "node:test"

import { isServiceRoleAuthorization } from "../supabase/functions/toast-order-alert-eligibility-v1/authorize_request.ts"

test("requires the exact service-role bearer credential", () => {
  assert.equal(isServiceRoleAuthorization("Bearer service-secret", "service-secret"), true)
  assert.equal(isServiceRoleAuthorization("Bearer anon-key", "service-secret"), false)
  assert.equal(isServiceRoleAuthorization(null, "service-secret"), false)
  assert.equal(isServiceRoleAuthorization("Bearer service-secret", undefined), false)
})
