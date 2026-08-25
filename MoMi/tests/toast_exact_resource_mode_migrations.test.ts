import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../supabase/migrations/", import.meta.url)
const migration = (name: string) => readFile(new URL(name, migrations), "utf8")

test("rejects non-repair exact-resource jobs when enqueued", async () => {
  const sql = await migration(
    "20260714174910_create_toast_acquisition_jobs.sql",
  )
  assert.match(sql, /new\.mode <> 'repair'/)
  assert.match(sql, /operation\.operation_key = new\.operation_key/)
  assert.match(sql, /operation\.exact_resource_only/)
  assert.match(sql, /before insert or update of operation_key, mode/)
})

test("does not claim legacy non-repair exact-resource jobs", async () => {
  const sql = await migration(
    "20260714175719_create_toast_acquisition_work_functions.sql",
  )
  assert.match(sql, /from toast_acquisition\.operations as operation/)
  assert.match(sql, /operation\.operation_key = job\.operation_key/)
  assert.match(sql, /not operation\.exact_resource_only or job\.mode = 'repair'/)
})

test("payment detail fanout explicitly uses repair mode", async () => {
  const sql = await migration(
    "20260715055915_enqueue_toast_payment_details.sql",
  )
  assert.match(sql, /parent\.restaurant_guid, 'repair',/)
  assert.doesNotMatch(sql, /parent\.restaurant_guid, parent\.mode,/)
})
