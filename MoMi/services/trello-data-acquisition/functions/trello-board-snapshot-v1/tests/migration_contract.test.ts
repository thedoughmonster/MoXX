// service-owner: trello-data-acquisition

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL(
  "../../../../../supabase/migrations/20260728194330_add_trello_board_snapshot_acquisition.sql",
  import.meta.url,
)
const dispatchUrl = new URL(
  "../../../../../supabase/migrations/20260823161500_add_trello_board_snapshot_dispatch_trigger_adapter.sql",
  import.meta.url,
)

test("snapshot acquisition is durable, private, and complete", async () => {
  const sql = await readFile(migrationUrl, "utf8")

  assert.equal(sql.startsWith("-- service-owner: trello-data-acquisition\n"), true)
  assert.match(sql, /board_snapshot_jobs/)
  assert.match(sql, /response_payload jsonb/)
  assert.match(sql, /response_raw_text text/)
  assert.match(sql, /capability_token_hash/)
  assert.match(sql, /security definer\s+set search_path = ''/)
  assert.match(sql, /from public, anon, authenticated/)
  assert.doesNotMatch(sql, /grant .* to (public|anon|authenticated)/i)
})

test("snapshot dispatch recovers missed wakes and expired claims", async () => {
  const sql = await readFile(dispatchUrl, "utf8")

  assert.equal(sql.startsWith("-- service-owner: trello-data-acquisition\n"), true)
  assert.match(sql, /next_attempt_at timestamptz/)
  assert.match(sql, /lease_expires_at timestamptz/)
  assert.match(sql, /coalesce\(claimed_at, requested_at\) \+ interval '120 seconds'/)
  assert.match(sql, /interval '120 seconds'/)
  assert.match(sql, /job\.attempt_count < 3/)
  assert.match(sql, /claim_lease_attempts_exhausted/)
  assert.match(sql, /for update skip locked/)
  assert.match(sql, /limit 8/)
  assert.match(sql, /momi-trello-board-snapshot-dispatch-recovery-v1/)
  assert.match(sql, /'\/functions\/v1\/trello-board-snapshot-v1'/)
  assert.match(sql, /'job_id', new\.job_id::text/)
  assert.match(sql, /'capability_token', new\.wake_capability_token/)
  assert.match(sql, /where name = 'momi_project_url'/)
  assert.match(sql, /where name = 'momi_publishable_key'/)
  assert.match(sql, /new\.next_attempt_at > pg_catalog\.clock_timestamp\(\)/)
  assert.doesNotMatch(sql, /new\.next_attempt_at > now\(\)/)
  assert.match(sql, /set wake_capability_token = null/)
  assert.match(sql, /job\.lease_expires_at > pg_catalog\.clock_timestamp\(\)/)
  assert.doesNotMatch(sql, /qdzZg93X|68de7ae7c11ba32702e21af8/)
  assert.doesNotMatch(sql, /https:\/\/api\.trello\.com/)
})
