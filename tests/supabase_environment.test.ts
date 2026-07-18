import assert from "node:assert/strict"
import test from "node:test"

import { supabaseEnvironment } from
  "../scripts/deploy/supabase_environment.ts"

test("uses the official profile and strips ambient database credentials", () => {
  const environment = supabaseEnvironment({
    SUPABASE_PROFILE: "unsafe-profile",
    SUPABASE_DB_PASSWORD: "release-secret",
    PGPASSWORD: "ambient-secret",
    SAFE_VALUE: "preserved",
  })
  assert.equal(environment.SUPABASE_PROFILE, "supabase")
  assert.equal(environment.SUPABASE_TELEMETRY_DISABLED, "1")
  assert.equal(environment.SAFE_VALUE, "preserved")
  assert.equal(environment.SUPABASE_DB_PASSWORD, undefined)
  assert.equal(environment.PGPASSWORD, undefined)
})

test("exposes a database password only as child PGPASSWORD", () => {
  const environment = supabaseEnvironment({ SAFE_VALUE: "preserved" }, "secret")
  assert.equal(environment.PGPASSWORD, "secret")
  assert.equal(environment.SUPABASE_DB_PASSWORD, undefined)
})
