// service-owner: trello-evidence-ingestion

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL(
  "../../../../../supabase/migrations/20260728181543_add_raw_json_evidence_capture.sql",
  import.meta.url,
)

test("archive capture migration is owner-scoped and replay-safe", async () => {
  const sql = await readFile(migrationUrl, "utf8")

  assert.equal(sql.startsWith("-- service-owner: communications-archive\n"), true)
  assert.match(sql, /capture_raw_json_evidence_v1/)
  assert.match(sql, /security definer\s+set search_path = ''/)
  assert.match(sql, /archive_items_trello_action_unique/)
  assert.match(sql, /where source_type = 'trello_webhook'/)
  assert.match(sql, /raw evidence replay conflicts/)
  assert.match(sql, /from public, anon, authenticated/)
  assert.match(sql, /to service_role/)
  assert.doesNotMatch(sql, /grant .* to (public|anon|authenticated)/i)
})
