// service-owner: trello-data-acquisition

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL(
  "../../../../../supabase/migrations/20260728194330_add_trello_board_snapshot_acquisition.sql",
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
