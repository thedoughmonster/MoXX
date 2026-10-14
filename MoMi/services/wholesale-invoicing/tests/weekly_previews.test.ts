import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { invoiceDatabase } from "./database.ts"
import { invoiceFixture } from "./fixture.ts"
import { saveOrder } from "./save.ts"
import { previewWeek } from "./preview.ts"

test("weekly previews use exact case prices, stable identities and immutable revisions", async (t) => {
  const db = await invoiceDatabase()
  t.after(() => db.close())
  const created = await saveOrder(db)
  const [first, retry] = await Promise.all([
    previewWeek(db, created.order_id, "2026-10-12"), previewWeek(db, created.order_id, "2026-10-12"),
  ])
  assert.deepEqual(retry, first)
  assert.equal(first.total_minor, 13500)
  assert.equal(first.subtotal_minor, 13500)
  assert.equal(first.tax_minor, 0)
  assert.equal(first.enabled, false)
  assert.equal(first.basis, "standing_order")
  assert.equal(first.lines[0].amount_minor, 9000)
  assert.equal(first.lines[0].catalog_snapshot.pack_size, 40)
  assert.equal(first.lines[0].notes, "2026-10-12: 2 cases of Mixed Case (standing order); Weekly agreement")
  assert.equal(first.lines[1].date, "2026-10-14")
  await saveOrder(db, 1, { ...invoiceFixture.version, effective_from: "2026-10-15", notes: "new notes" })
  const revised = await previewWeek(db, created.order_id, "2026-10-12")
  assert.equal(revised.week_id, first.week_id)
  assert.notEqual(revised.snapshot_id, first.snapshot_id)
  assert.equal(revised.total_minor, first.total_minor)
  const counts = await db.query(`select
    (select count(*)::int from bridge.invoice_weeks) as weeks,
    (select count(*)::int from bridge.invoice_weekly_snapshots) as snapshots`)
  assert.deepEqual(counts.rows[0], { weeks: 1, snapshots: 2 })
  const other = await saveOrder(db, 0, invoiceFixture.version, randomUUID(),
    { ...invoiceFixture.order, environment: "prod" })
  const otherPreview = await previewWeek(db, other.order_id, "2026-10-12")
  assert.notEqual(otherPreview.week_id, first.week_id)
})

test("DST weeks and initial effectivity expand seven local calendar dates", async (t) => {
  const db = await invoiceDatabase()
  t.after(() => db.close())
  const created = await saveOrder(db)
  for (const monday of ["2026-03-02", "2026-10-26"]) {
    const preview = await previewWeek(db, created.order_id, monday)
    assert.equal(preview.timezone, "America/New_York")
    assert.equal(preview.dates.length, 7)
    assert.equal(new Set(preview.dates.map((date) => date.date)).size, 7)
    assert.equal(preview.dates[0].date, monday)
    assert.equal(preview.dates[6].date, monday === "2026-03-02" ? "2026-03-08" : "2026-11-01")
    assert.equal(preview.total_minor, 13500)
  }
  const partial = await saveOrder(db, 0,
    { ...invoiceFixture.version, effective_from: "2026-10-14" }, randomUUID(),
    { ...invoiceFixture.order, client_id: "new-client" })
  const preview = await previewWeek(db, partial.order_id, "2026-10-12")
  assert.equal(preview.total_minor, 4500)
  assert.equal(preview.dates[0].state, "not_started")
  assert.equal(preview.dates[2].state, "scheduled")
  await assert.rejects(previewWeek(db, created.order_id, "2026-10-13"), /invoice_invalid_week/)
  await assert.rejects(previewWeek(db, created.order_id, "infinity"), /invoice_invalid_week/)
  await assert.rejects(previewWeek(db, randomUUID(), "2026-10-12"), /invoice_order_not_found/)
})

test("later full versions replace older future plans without repricing prior days", async (t) => {
  const db = await invoiceDatabase()
  t.after(() => db.close())
  const created = await saveOrder(db)
  await saveOrder(db, 1, { ...invoiceFixture.version, effective_from: "2026-10-21", notes: "future" })
  await saveOrder(db, 2, { ...invoiceFixture.version, effective_from: "2026-10-14", paused: true, lines: [] })
  const later = await previewWeek(db, created.order_id, "2026-10-19")
  assert.equal(later.total_minor, 0)
  assert.equal(later.lines.length, 0)
  assert.ok(later.dates.every((day) => day.state === "paused"))
  const earlier = await previewWeek(db, created.order_id, "2026-10-05")
  assert.equal(earlier.total_minor, 13500)
})

test("the exact safe-integer limit survives calculation and larger totals preserve prior evidence", async (t) => {
  const db = await invoiceDatabase()
  t.after(() => db.close())
  const line = { ...invoiceFixture.version.lines[0], case_quantity: 100000, case_price_minor: 1000000000 }
  const lines = Array.from({ length: 90 }, (_, index) => ({ ...line, catalog_item_id: "case-" + index }))
  lines.push({ ...line, catalog_item_id: "remainder-cases", case_quantity: 7199 })
  lines.push({ ...line, catalog_item_id: "remainder-minor", case_quantity: 1, case_price_minor: 254740991 })
  const version = { ...invoiceFixture.version, lines }
  const created = await saveOrder(db, 0, version)
  const exact = await previewWeek(db, created.order_id, "2026-10-12")
  assert.equal(exact.total_minor, Number.MAX_SAFE_INTEGER)
  assert.equal(exact.lines.length, 92)
  assert.equal(exact.lines.reduce((sum, item) => sum + BigInt(item.amount_minor), 0n), 9007199254740991n)
  const changed = structuredClone(version)
  changed.lines[91].case_price_minor += 1
  await saveOrder(db, 1, changed)
  for (const monday of ["2026-10-12", "2026-10-19"]) {
    await assert.rejects(previewWeek(db, created.order_id, monday), /invoice_total_out_of_range/)
  }
  const evidence = await db.query<{ document: unknown }>("select document from bridge.invoice_weekly_snapshots")
  assert.deepEqual(evidence.rows.map((row) => row.document), [exact])
  const identities = await db.query("select count(*)::int as count from bridge.invoice_weeks")
  assert.equal(identities.rows[0].count, 1)
})
