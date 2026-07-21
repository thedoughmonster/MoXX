import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { runSupabaseDatabase } from
  "../scripts/deploy/run_supabase_database.ts"
import { supabaseDatabaseEnvironment } from
  "../scripts/deploy/supabase_database_environment.ts"

test("requires a temporary access token without exposing one", () => {
  assert.throws(
    () => supabaseDatabaseEnvironment({}),
    /SUPABASE_DB_PASSWORD must contain a temporary Supabase database access token/,
  )
})

test("scopes the temporary token to a database-only Supabase child", () => {
  const launcher = fileURLToPath(
    new URL("./fixtures/supabase_child_probe.ts", import.meta.url),
  )
  const previous = process.env.SUPABASE_DB_PASSWORD
  process.env.SUPABASE_DB_PASSWORD = "test-temporary-access-token"
  try {
    const output = runSupabaseDatabase(["probe-argument"], true, launcher)
    const child = JSON.parse(output) as Record<string, unknown>
    assert.deepEqual(child.args, ["probe-argument"])
    assert.equal(child.hasReleasePassword, true)
    assert.equal(child.hasPostgresPassword, true)
    assert.equal(child.passwordsMatch, true)
    assert.doesNotMatch(output, /test-temporary-access-token/)
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_DB_PASSWORD
    else process.env.SUPABASE_DB_PASSWORD = previous
  }
})
