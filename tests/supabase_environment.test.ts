import assert from "node:assert/strict"
import test from "node:test"

import { supabaseEnvironment } from "../scripts/deploy/supabase_environment.ts"

test("Supabase maps the migration password to standard Postgres auth", () => {
  const patEnvironment = supabaseEnvironment({
    PGOPTIONS: "-c statement_timeout=0",
    SUPABASE_ACCESS_TOKEN: "sbp_pat",
    SUPABASE_DB_PASSWORD: "sbp_pat",
  })
  const passwordEnvironment = supabaseEnvironment({
    SUPABASE_ACCESS_TOKEN: "sbp_pat",
    SUPABASE_DB_PASSWORD: "database-password",
  })

  assert.equal(patEnvironment.PGPASSWORD, "sbp_pat")
  assert.equal(patEnvironment.PGOPTIONS, "-c statement_timeout=0")
  assert.equal(passwordEnvironment.PGPASSWORD, "database-password")
})
