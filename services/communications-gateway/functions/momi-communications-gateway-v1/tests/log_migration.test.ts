import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = new URL(
  "../../../../../supabase/migrations/20260723181733_add_provider_free_communications_logging.sql",
  import.meta.url,
)

test("admits an authenticated rate-limited log without provider or budget spend", async () => {
  const sql = await readFile(migration, "utf8")
  assert.match(sql, /admit_log_invocation_v1/u)
  assert.match(sql, /access_entries[\s\S]*user_id = p_user_id and email = p_email/u)
  assert.match(sql, /recent_count >= limits\.requests_per_minute/u)
  assert.match(sql, /daily_count >= limits\.requests_per_day/u)
  assert.match(sql, /'momi-internal', 'provider-free-log'/u)
  assert.match(sql, /reserved_micros[\s\S]*0, 0, 0/u)
  assert.doesNotMatch(sql, /provider_bindings/u)
})

test("terminalizes only one archived zero-provider operations receipt", async () => {
  const sql = await readFile(migration, "utf8")
  assert.match(sql, /complete_log_invocation_v1/u)
  assert.match(sql, /p_terminal_response ->> 'object' is distinct from 'momi\.log'/u)
  assert.match(sql, /status = 'admitted'[\s\S]*provider_calls = 0/u)
  assert.match(sql, /billed_micros = 0/u)
  assert.match(sql, /grant execute[\s\S]*to service_role/u)
})
