import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { assertSupabaseDbPassword } from
  "../scripts/release/assert_supabase_db_password.ts"
import { assertSupabaseProjectAccess } from
  "../scripts/release/assert_supabase_project_access.ts"

test("requires a password-authenticated Supabase database session", () => {
  assert.throws(() => assertSupabaseDbPassword({}), /SUPABASE_DB_PASSWORD/)
  assert.doesNotThrow(() => assertSupabaseDbPassword({
    SUPABASE_DB_PASSWORD: "present-but-never-logged",
  }))
  assert.equal(
    assertSupabaseDbPassword({ SUPABASE_DB_PASSWORD: "database-secret" }),
    "database-secret",
  )
})

test("requires CLI access to the exact release project", () => {
  const projects = JSON.stringify([
    { id: "abcdefghijklmnopqrst", ref: "abcdefghijklmnopqrst" },
  ])
  assert.doesNotThrow(() =>
    assertSupabaseProjectAccess(projects, "abcdefghijklmnopqrst")
  )
  assert.throws(
    () => assertSupabaseProjectAccess(projects, "tsrqponmlkjihgfedcba"),
    /cannot access target project/,
  )
  assert.throws(() => assertSupabaseProjectAccess("{}", "abcdefghijklmnopqrst"))
  assert.throws(() => assertSupabaseProjectAccess("not-json", "abcdefghijklmnopqrst"))
})

test("confines the database password to Supabase CLI processes", async () => {
  const preflight = await readFile(
    new URL("../scripts/release/assert_release_preflight.ts", import.meta.url),
    "utf8",
  )
  const command = await readFile(
    new URL("../scripts/release/run_command.ts", import.meta.url),
    "utf8",
  )
  const supabase = await readFile(
    new URL("../scripts/deploy/run_supabase.ts", import.meta.url),
    "utf8",
  )
  const environment = await readFile(
    new URL("../scripts/deploy/supabase_environment.ts", import.meta.url),
    "utf8",
  )
  const password = preflight.indexOf("assertSupabaseDbPassword()")
  const target = preflight.indexOf("assertSupabaseProjectAccess(")
  const validation = preflight.indexOf('"scripts/check.ts"')
  assert.ok(password >= 0 && password < target && target < validation)
  assert.match(command, /delete env\.SUPABASE_DB_PASSWORD/)
  assert.match(command, /delete env\.PGPASSWORD/)
  assert.match(supabase, /supabaseEnvironment\(process\.env, databasePassword\)/)
  assert.match(environment, /delete environment\.SUPABASE_DB_PASSWORD/)
  assert.match(environment, /delete environment\.PGPASSWORD/)
  assert.match(environment, /environment\.PGPASSWORD = databasePassword/)
  assert.doesNotMatch(supabase, /"--password"|SUPABASE_DB_PASSWORD/)
  assert.doesNotMatch(preflight, /console\..*SUPABASE_DB_PASSWORD/)
})
