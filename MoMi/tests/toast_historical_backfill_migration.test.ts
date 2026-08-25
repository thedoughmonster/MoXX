import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../supabase/migrations/", import.meta.url)
const name = "20260714182753_create_toast_historical_backfill_planner.sql"

test("clamps the first monthly backfill window to firstBusinessDate", async () => {
  const sql = await readFile(new URL(name, migrations), "utf8")

  assert.match(sql, /greatest\(month_start, first_date\)::timestamp/)
  assert.match(sql, /operation_key \|\| ':' \|\| p_restaurant_guid \|\| ':' \|\| month_start/)
})

test("uses supported labor parameters for historical windows", async () => {
  const sql = await readFile(new URL(name, migrations), "utf8")

  assert.match(sql, /operation_key = 'toast\.labor\.time_entries\.v1'/)
  assert.match(sql, /\{"includeMissedBreaks":true\}/)
  assert.doesNotMatch(sql, /includeArchived/)
})

test("keeps pre-activation backfill durable without worker wakeups", async () => {
  const sql = await readFile(new URL(name, migrations), "utf8")

  assert.match(sql, /schedule\.restaurant_guid = p_restaurant_guid and schedule\.active/)
  assert.equal(sql.match(/else 'infinity'::timestamptz end/g)?.length, 2)
  assert.equal(sql.match(/next_attempt_at/g)?.length, 2)
})
