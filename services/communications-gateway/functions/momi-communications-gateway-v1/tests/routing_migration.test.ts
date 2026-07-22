import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = new URL(
  "../../../../../supabase/migrations/20260722113112_add_communications_ai_routing.sql",
  import.meta.url,
)

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
  assert.match(sql, /endpoint = 'https:\/\/api\.openai\.com\/v1\/responses'/u)
})

test("gives new staff a bounded default and Zac an adjustable full ceiling", async () => {
  const sql = await readFile(migration, "utf8")
  assert.match(sql, /default 'quick'/u)
  assert.match(sql, /default 'standard'/u)
  assert.match(sql, /access\.email = 'zac@doughmonster\.com'/u)
  assert.match(sql, /default_route = 'standard', maximum_route = 'maximum'/u)
})
