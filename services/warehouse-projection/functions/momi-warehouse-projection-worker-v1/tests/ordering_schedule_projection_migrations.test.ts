import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"

const migrations = new URL("../../../../../supabase/migrations/", import.meta.url)
const fixture = JSON.parse(readFileSync(new URL(
  "../../../../../tests/fixtures/online_ordering_schedules.fixture.json",
  import.meta.url,
), "utf8"))
const readMigration = (suffix: string) => {
  const name = readdirSync(migrations).find((entry) =>
    entry.endsWith(`_${suffix}.sql`)
  )
  assert.ok(name, `missing migration ${suffix}`)
  return readFileSync(new URL(name, migrations), "utf8")
}

test("normalizes every ordering schedule policy into DM vocabulary", () => {
  const sql = readMigration("canonicalize_ordering_schedule_documents")
  const returned = sql.slice(sql.indexOf("return jsonb_strip_nulls"))

  assert.equal(fixture.storedResponse.acceptScheduledOrders, true)
  assert.equal(fixture.storedResponse.scheduledOrderMaxDays, 21)
  assert.equal(fixture.expected.canonicalFulfillmentMode, "pickup")
  assert.equal(fixture.expected.canonicalCutoffPolicy, "preparation_cutoff")
  for (const key of [
    "schedule_kind", "timezone", "accepts_scheduled_orders",
    "scheduled_order_horizon_days", "last_order_acceptance_policy",
    "weekly_periods", "date_exceptions",
  ]) assert.match(returned, new RegExp(`'${key}'`))
  assert.match(sql, /when 'TAKE_OUT' then 'pickup'/)
  assert.match(sql, /when 'DELIVERY' then 'delivery'/)
  assert.match(sql, /when 'UNTIL_PREPTIME_CUTOFF' then 'preparation_cutoff'/)
})

test("supports API strings, webhook arrays, overnight periods, and closures", () => {
  const sql = readMigration("canonicalize_ordering_schedule_documents")
  const wrapped = fixture.storedResponse.servicePeriods[0].dayPeriods[1]

  assert.equal(wrapped.day, fixture.expected.wrappedDay)
  assert.match(sql, /jsonb_typeof\(p_value\) = 'array'/)
  assert.match(sql, /trim\(trailing 'Z'/)
  assert.match(sql, /'ends_next_day', local_end::time < local_start::time/)
  assert.match(sql, /jsonb_array_length\(item -> 'timeRanges'\) = 0/)
  assert.match(sql, /toast_schedule_date\(item -> 'businessDate'\)/)
})

test("routes schedules through the dedicated document projector", () => {
  const sql = readMigration("route_canonical_ordering_schedule_projection")

  assert.match(sql, /resource_type = 'ordering_schedule'/)
  assert.match(sql, /canonical_toast_ordering_schedule_document/)
  assert.match(sql, /:ordering-schedule-v1'/)
  assert.match(sql, /'projection_contract'.*'canonical-ordering-schedule-v1'/s)
  assert.match(sql, /warehouse\.schedule\.observed|warehouse\.' \|\| entity_type/)
})

test("replays without erasing the prior canonical projection", () => {
  const sql = readMigration("replay_canonical_ordering_schedules")

  assert.match(sql, /project_toast_resource_observation/)
  assert.match(sql, /:ordering-schedule-v1'/)
  assert.match(sql, /jsonb_typeof.*weekly_periods/s)
  assert.match(sql, /jsonb_typeof.*date_exceptions/s)
  assert.doesNotMatch(sql, /delete from momi_warehouse|update momi_warehouse/)
})
