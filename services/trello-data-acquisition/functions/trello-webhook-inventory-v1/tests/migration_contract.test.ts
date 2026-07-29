// service-owner: trello-data-acquisition

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL(
  "../../../../../supabase/migrations/20260729130326_add_trello_webhook_inventory.sql",
  import.meta.url,
)

test("webhook inventory is durable, capability-bound, and private", async () => {
  const sql = await readFile(migrationUrl, "utf8")

  assert.equal(sql.startsWith("-- service-owner: trello-data-acquisition\n"), true)
  assert.match(sql, /webhook_inventory_jobs/)
  assert.match(sql, /enqueue_webhook_inventory_v1/)
  assert.match(sql, /claim_webhook_inventory_v1/)
  assert.match(sql, /response_raw_text/)
  assert.match(sql, /capability_token_hash/)
  assert.match(sql, /from public, anon, authenticated/)
  assert.doesNotMatch(sql, /grant .* to (public|anon|authenticated)/i)
})
