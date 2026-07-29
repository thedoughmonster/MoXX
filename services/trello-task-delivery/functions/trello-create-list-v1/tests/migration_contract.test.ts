// service-owner: trello-task-delivery

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationUrl = new URL(
  "../../../../../supabase/migrations/20260728194337_add_trello_list_delivery.sql",
  import.meta.url,
)

test("list delivery is durable, private, and ambiguity-safe", async () => {
  const sql = await readFile(migrationUrl, "utf8")

  assert.equal(sql.startsWith("-- service-owner: trello-task-delivery\n"), true)
  assert.match(sql, /operation_type = 'create_list'/)
  assert.match(sql, /'ambiguous'/)
  assert.match(sql, /client_identifier text/)
  assert.match(sql, /response_raw_text text/)
  assert.match(sql, /capability_token_hash/)
  assert.match(sql, /from public, anon, authenticated/)
  assert.doesNotMatch(sql, /grant .* to (public|anon|authenticated)/i)
})
