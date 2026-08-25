import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../supabase/migrations/", import.meta.url)
const readMigration = (name: string) =>
  readFile(new URL(name, migrations), "utf8")

test("paces acquisition while protecting live work", async () => {
  const sql = await readMigration(
    "20260715110414_smooth_acquisition_wakeups.sql",
  )

  assert.match(sql, /schedule := '5 seconds'/)
  assert.match(sql, /limit 1 for update skip locked/)
  assert.match(sql, /active := true/)
  assert.match(sql, /when status = 'running' then 0/)
  assert.match(sql, /when mode in \('live', 'snapshot', 'reconcile'\) then 1/)
  assert.match(sql, /when mode = 'repair' then 2/)
  assert.match(sql, /else 3/)
  assert.match(sql, /Acquisition recovery cadence is invalid/)
})

test("defers payment detail fanout into the paced lane", async () => {
  const sql = await readMigration(
    "20260715104651_pace_payment_detail_fanout.sql",
  )

  assert.match(sql, /create or replace function/)
  assert.match(sql, /parent\.status = 'running'/)
  assert.match(sql, /operation\.exact_resource_only and operation\.is_enabled/)
  assert.match(sql, /idempotency_key, next_attempt_at/)
  assert.match(sql, /now\(\) \+ interval '15 seconds'/)
  assert.match(sql, /on conflict \(idempotency_key\) do nothing/)
})

test("captures the source-owned backfill anchor without a guessed date", async () => {
  const sql = await readMigration(
    "20260715104700_capture_restaurant_backfill_anchor.sql",
  )

  assert.match(sql, /operation_key = 'toast\.restaurants\.get\.v1'/)
  assert.match(sql, /restaurant\.is_enabled/)
  assert.match(sql, /operation\.is_enabled/)
  assert.match(sql, /'includeArchived', true/)
  assert.match(sql, /toast\.restaurant\.backfill-anchor\.v1:/)
  assert.match(sql, /on conflict \(idempotency_key\) do nothing/)
  assert.match(sql, /Paced acquisition recovery is not active/)
  assert.doesNotMatch(sql, /2024|2025|2026/)
})
