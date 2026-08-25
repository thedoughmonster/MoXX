// service-owner: trello-task-delivery

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL(
  "../../../../../supabase/migrations/20260729125210_extend_trello_activation_delivery.sql",
  import.meta.url,
)

test("card moves are durable, capability-bound, and private", async () => {
  const sql = await readFile(migrationUrl, "utf8")

  assert.equal(sql.startsWith("-- service-owner: trello-task-delivery\n"), true)
  assert.match(sql, /enqueue_move_card_v1/)
  assert.match(sql, /claim_move_card_v1/)
  assert.match(sql, /operation_type = 'move_card'/)
  assert.match(sql, /existing_operation\.operation_type <> 'create_list'/)
  assert.match(sql, /target_list_id/)
  assert.match(sql, /capability_token_hash/)
  assert.match(sql, /from public, anon, authenticated/)
  assert.doesNotMatch(sql, /grant .* to (public|anon|authenticated)/i)
})
