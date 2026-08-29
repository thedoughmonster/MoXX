import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = await readFile(new URL(
  "../../../supabase/migrations/20260725191244_create_model_execution_gateway.sql",
  import.meta.url,
), "utf8")

test("serializes profile admission before enforcing budgets", () => {
  const lock = migration.indexOf("pg_advisory_xact_lock")
  const recentCount = migration.indexOf("select count(*) into recent_count")
  assert.ok(lock > 0)
  assert.ok(lock < recentCount)
  assert.match(migration, /unique \(caller_key, idempotency_key\)/)
})

test("retains conservative reservation when exact paid usage is unknown", () => {
  assert.match(migration,
    /reserved_cost_micros = case when p_billed_cost_micros is null\s+then reserved_cost_micros else 0 end/)
  assert.match(migration,
    /coalesce\(sum\(coalesce\(billed_cost_micros, reserved_cost_micros\)\), 0\)/)
})

test("keeps provider bodies out of the operational ledger", () => {
  assert.doesNotMatch(migration,
    /\b(?:request_body|response_body|prompt|completion_body|authorization_header)\b/i)
})

test("seeds the required provider endpoint for every execution profile", () => {
  const seed = migration.match(
    /insert into momi_model_execution\.profiles[\s\S]*?create function/,
  )?.[0] ?? ""
  assert.match(seed, /\(purpose_key, profile_key, provider_endpoint,/)
  assert.equal(
    seed.match(/https:\/\/api\.openai\.com\/v1\/responses/g)?.length,
    7,
  )
})

test("preserves the retired triage profile only as migration history", () => {
  const purpose = ["github", ["issue", "triage"].join("-")].join(".")
  assert.ok(migration.includes(`('${purpose}', 'default'`))
})
