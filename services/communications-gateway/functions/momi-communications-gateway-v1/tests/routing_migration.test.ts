import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = new URL(
  "../../../../../supabase/migrations/20260722113112_add_communications_ai_routing.sql",
  import.meta.url,
)
const persistRoute = new URL("../src/persist_route.ts", import.meta.url)

test("stores provider-neutral profiles and enforces route ceilings", async () => {
  const sql = await readFile(migration, "utf8")
  for (const route of ["quick", "standard", "deep", "maximum"]) {
    assert.match(sql, new RegExp(`'${route}'`, "u"))
  }
  assert.match(sql, /'maximum'.*false, true/u)
  assert.match(sql, /profile\.route_rank <= ceiling\.route_rank/u)
  assert.match(sql, /selected_cost \* attempt_count/u)
  assert.match(sql, /p_requested_route = 'auto' then 3 else 2/u)
  assert.match(sql, /provider_calls between 0 and 3/u)
  assert.match(sql, /set_user_routing_v1/u)
  assert.match(sql, /router_endpoint.*v1\/responses/su)
  assert.match(sql, /answer_endpoint.*v1\/responses/su)
  assert.doesNotMatch(sql, /update momi_communications_gateway\.provider_bindings/u)
  assert.match(sql, /accrued_cost_micros/u)
  assert.match(sql, /p_payload_tokens \* profile\.input_micros_per_token/u)
  assert.match(sql, /other_spend \+ invocation\.accrued_cost_micros \+ attempt_cost/u)
  assert.match(sql, /billed_micros = accrued_cost_micros/u)
})

test("gives new staff a bounded default and Zac an adjustable full ceiling", async () => {
  const sql = await readFile(migration, "utf8")
  assert.match(sql, /default 'quick'/u)
  assert.match(sql, /default 'standard'/u)
  assert.match(sql, /access\.email = 'zac@doughmonster\.com'/u)
  assert.match(sql, /default_route = 'standard', maximum_route = 'maximum'/u)
})

test("prices every provider attempt from its actual outgoing payload", async () => {
  const sql = await readFile(migration, "utf8")
  const persistence = await readFile(persistRoute, "utf8")
  assert.match(sql, /p_payload_tokens \* policy\.router_input_micros_per_token/u)
  assert.match(sql, /p_payload_tokens \* profile\.input_micros_per_token/u)
  assert.doesNotMatch(persistence, /invocation\.input_tokens/u)
  assert.doesNotMatch(persistence, /reserved_micros/u)
})
