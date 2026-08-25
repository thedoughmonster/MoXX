// service-owner: trello-task-delivery

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL(
  "../../../../../supabase/migrations/20260729125210_extend_trello_activation_delivery.sql",
  import.meta.url,
)

test("webhook registration is durable, capability-bound, and private", async () => {
  const sql = await readFile(migrationUrl, "utf8")

  assert.equal(sql.startsWith("-- service-owner: trello-task-delivery\n"), true)
  assert.match(sql, /enqueue_register_webhook_v1/)
  assert.match(sql, /claim_register_webhook_v1/)
  assert.match(sql, /operation_type = 'register_webhook'/)
  assert.match(sql, /webhook_callback_url/)
  assert.match(sql, /webhook_inventory_job_id/)
  assert.match(sql, /callback_head_evidence_ref/)
  assert.match(sql, /callback_head_http_status = 200/)
  assert.match(sql, /capability_token_hash/)
  assert.match(sql, /from public, anon, authenticated/)
  assert.doesNotMatch(sql, /grant .* to (public|anon|authenticated)/i)
})
