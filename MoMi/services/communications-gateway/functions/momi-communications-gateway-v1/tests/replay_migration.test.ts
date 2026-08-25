import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = new URL(
  "../../../../../supabase/migrations/20260723092408_add_gateway_terminal_replay.sql",
  import.meta.url,
)

test("persists only a valid archived completed assistant response", async () => {
  const sql = await readFile(migration, "utf8")
  assert.match(sql, /add column terminal_response jsonb/)
  assert.match(sql, /create function momi_communications_gateway\.complete_invocation_v2/)
  assert.match(sql, /p_terminal_receipt is null/)
  assert.match(sql, /p_terminal_response #>> '\{choices,0,message,role\}'[\s\S]*is distinct from 'assistant'/)
  assert.match(sql, /length\(btrim\(coalesce\([\s\S]*\{choices,0,message,content\}[\s\S]*\)\)\) = 0/)
  assert.match(sql, /where invocation_id = p_invocation_id and status = 'provider_started'/)
})

test("binds replay reads to the full admitted request identity", async () => {
  const sql = await readFile(migration, "utf8")
  assert.match(sql, /invocation\.invocation_id = p_invocation_id/)
  assert.match(sql, /invocation\.user_id = p_user_id/)
  assert.match(sql, /invocation\.conversation_id = p_conversation_id/)
  assert.match(sql, /invocation\.turn_id = p_turn_id/)
  assert.match(sql, /invocation\.request_hash = p_request_hash/)
  assert.match(sql, /revoke all on function momi_communications_gateway\.get_invocation_replay_v1[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function momi_communications_gateway\.get_invocation_replay_v1[\s\S]*to service_role/)
})
