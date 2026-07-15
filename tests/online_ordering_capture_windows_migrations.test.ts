import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrations = new URL("../supabase/migrations/", import.meta.url)
const fixtureUrl = new URL("./fixtures/online_ordering_schedules.fixture.json", import.meta.url)
const [scheduleSql, captureSql, triggerSql, backboneSql, fixtureText] = await Promise.all([
  readFile(new URL("20260714174936_create_toast_acquisition_schedules.sql", migrations), "utf8"),
  readFile(new URL("20260714183623_sync_online_ordering_capture_windows.sql", migrations), "utf8"),
  readFile(new URL("20260714183739_add_online_ordering_sync_triggers.sql", migrations), "utf8"),
  readFile(new URL("20260714175723_schedule_warehouse_backbone_reconciliation.sql", migrations), "utf8"),
  readFile(fixtureUrl, "utf8"),
])
const fixture = JSON.parse(fixtureText)

test("declares every online-ordering function signature once", () => {
  const chain = [scheduleSql, captureSql, triggerSql].join("\n")
  const declarations = [...chain.matchAll(
    /create(?: or replace)? function\s+(toast_acquisition\.[a-z0-9_]+)\s*\(([^)]*)\)/gi,
  )]
  const signatures = declarations.map(([, name, args]) =>
    `${name.toLowerCase()}(${args.replace(/\bp_\w+\s+/g, "").replace(/\s+/g, "")})`)

  assert.equal(new Set(signatures).size, signatures.length)
  for (const helper of ["ordering_schedule_array", "ordering_schedule_scalar"]) {
    assert.equal(signatures.filter((value) => value.includes(`.${helper}(`)).length, 1)
  }
  assert.doesNotMatch(triggerSql, /function toast_acquisition\.ordering_schedule_(array|scalar)/)
})

test("accepts stored string times and webhook hour-minute arrays", () => {
  const storedRange = fixture.storedResponse.servicePeriods[0].dayPeriods[0].timeRanges[0]
  const webhookRange = fixture.webhookPayload.details.orderingSchedule
    .servicePeriods[0].dayPeriods[0].timeRanges[0]

  assert.equal(typeof storedRange.start, "string")
  assert.deepEqual(webhookRange.start, [8, 0])
  assert.equal(fixture.malformedTimes.length, 4)
  assert.match(captureSql, /jsonb_typeof\(p_value\) = 'array'/)
  assert.match(captureSql, /time array must be \[hour,minute\]/)
  assert.match(captureSql, /trim\(trailing 'Z' from raw_value\)/)
  assert.match(captureSql, /ordering schedule timezone must be America\/New_York/)
})

test("derives recurring and date-specific replacement windows before mutation", () => {
  const overrides = fixture.storedResponse.overrides
  const derivedAt = captureSql.indexOf("into derived_windows")
  const readinessAt = captureSql.indexOf("if not toast_acquisition.capture_window_policy_ready")
  const updateAt = captureSql.indexOf("update toast_acquisition.capture_windows")

  assert.equal(fixture.storedResponse.servicePeriods.length, fixture.expected.recurringPeriodCount)
  assert.equal(overrides[0].businessDate, fixture.expected.openOverrideDate)
  assert.equal(overrides[0].timeRanges.length, 1)
  assert.equal(overrides[1].businessDate, fixture.expected.closedOverrideDate)
  assert.equal(overrides[1].timeRanges.length, 0)
  assert.ok(derivedAt > 0 && readinessAt > derivedAt && updateAt > readinessAt)
  assert.match(captureSql, /periods as materialized/)
  assert.match(captureSql, /override_behaviors as materialized/)
  assert.match(captureSql, /applied\.behavior = base_ranges\.behavior/)
  assert.match(captureSql, /business_date \+ 1 from override_dates/)
  assert.match(captureSql, /lead\(segment_start\).* - 2 as segment_end/)
})

test("uses configured buffer policies and wrapped overnight periods", () => {
  const wrapped = fixture.storedResponse.servicePeriods[0].dayPeriods[1]

  assert.equal(wrapped.day, fixture.expected.wrappedDay)
  assert.equal(wrapped.timeRanges[0].start, "20:00")
  assert.equal(wrapped.timeRanges[0].end, "02:00")
  assert.match(captureSql, /local_end < local_start then 86400/)
  assert.match(captureSql, /capture_window_policies (?:as )?policy/)
  assert.match(captureSql, /policy\.buffer_before_minutes/)
  assert.match(captureSql, /policy\.buffer_after_minutes/)
  assert.match(captureSql, /capture_window_policy_missing/)
  assert.match(backboneSql, /local_end < capture_window\.local_start/)
  assert.match(backboneSql, /then interval '1 day'/)
})

test("keeps policies runtime-configured and gates capture-window activation", () => {
  assert.doesNotMatch(scheduleSql, /insert into toast_acquisition\.capture_window_policies/i)
  assert.doesNotMatch(scheduleSql, /buffer_(before|after)_minutes integer not null default/i)
  assert.doesNotMatch(scheduleSql, /\btime '\d{2}:\d{2}'/)
  assert.match(scheduleSql, /active boolean not null default false/)
  assert.match(scheduleSql, /select count\(\*\) = 7 from toast_acquisition\.capture_window_policies/)
  assert.match(scheduleSql, /where restaurant_guid = new\.restaurant_guid for share/)
  assert.match(captureSql, /where restaurant_guid = p_restaurant_guid for share/)
  assert.match(scheduleSql, /if new\.active and new\.window_key is not null/)
  assert.match(scheduleSql, /capture_window_not_derived/)
  assert.match(scheduleSql,
    /capture_windows[\s\S]*window_key = new\.window_key[\s\S]*and active/)
  assert.match(scheduleSql, /before insert or update of active, window_key, restaurant_guid/)
})

test("replays archived schedules after policy bootstrap and later changes", () => {
  assert.match(triggerSql, /from toast_raw\.resource_observations as observation/)
  assert.match(triggerSql, /join toast_raw\.resource_versions as version/)
  assert.match(triggerSql, /webhook\.payload #> '\{details,orderingSchedule\}'/)
  assert.match(triggerSql, /order by observed_at desc/)
  assert.match(triggerSql, /after insert or update on toast_acquisition\.capture_window_policies/)
  assert.match(triggerSql, /update toast_acquisition\.capture_window_policies set active = active/)
  assert.match(triggerSql, /'resync_ordering_schedule_policy'/)
})

test("routes both raw payload shapes through failure-logged synchronization", () => {
  assert.match(triggerSql, /schedule := raw_row -> 'payload'/)
  assert.match(triggerSql, /schedule := raw_row #> '\{payload,details,orderingSchedule\}'/)
  assert.match(triggerSql, /restaurantGuid/)
  assert.match(triggerSql, /'sync_ordering_schedule_resource'/)
  assert.match(triggerSql, /'sync_ordering_schedule_webhook'/)
  assert.match(triggerSql, /insert into toast_acquisition\.raw_processing_failures/)
  assert.match(triggerSql, /exception when others then null/)
})
