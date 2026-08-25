import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../supabase/migrations/", import.meta.url)
const fixName = "20260715090844_fix_toast_archive_update_trigger.sql"

test("branches on trigger context before reading table-specific records", async () => {
  const sql = await readFile(new URL(fixName, migrations), "utf8")
  const operationBranch = sql.indexOf("if tg_op = 'UPDATE' then")
  const webhookBranch = sql.indexOf("if tg_table_name = 'webhook_events' then")
  const webhookField = sql.indexOf("old.raw_body is null")
  const attemptBranch = sql.indexOf(
    "elsif tg_table_name = 'api_request_attempts' then",
  )
  const attemptField = sql.indexOf("old.finished_at is null")

  assert.ok(operationBranch > 0)
  assert.ok(webhookBranch > operationBranch && webhookField > webhookBranch)
  assert.ok(attemptBranch > webhookField && attemptField > attemptBranch)
  assert.doesNotMatch(sql, /tg_table_name = 'webhook_events'\s+and/)
  assert.doesNotMatch(sql, /tg_op = 'UPDATE'\s+and/)
})

test("closes interrupted attempts before resuming one bootstrap job", async () => {
  const sql = await readFile(new URL(fixName, migrations), "utf8")

  assert.match(sql, /update toast_raw\.api_request_attempts as attempt/)
  assert.match(sql, /attempt\.finished_at is null/)
  assert.match(sql, /error_code = 'worker_persistence_failed'/)
  assert.match(sql, /capability_token = gen_random_uuid\(\)/)
  assert.match(sql, /next_attempt_at = now\(\)/)
  assert.match(sql, /momi-toast-acquisition-wakeup-v1/)
  assert.match(sql, /active := true/)
})
