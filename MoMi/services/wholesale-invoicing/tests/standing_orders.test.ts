import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { invoiceDatabase } from "./database.ts"
import { invoiceFixture } from "./fixture.ts"
import { saveOrder } from "./save.ts"
import { previewWeek } from "./preview.ts"

test("standing orders preserve replay, expected revisions and effective-dated history", async (t) => {
  const db = await invoiceDatabase()
  t.after(() => db.close())
  const command = randomUUID()
  const created = await saveOrder(db, 0, invoiceFixture.version, command)
  assert.deepEqual(await saveOrder(db, 0, invoiceFixture.version, command), created)
  await assert.rejects(saveOrder(db, 0, { ...invoiceFixture.version, notes: "changed" }, command),
    /invoice_command_conflict/)
  await assert.rejects(saveOrder(db, 0), /invoice_revision_conflict/)
  const changed = structuredClone(invoiceFixture.version)
  changed.effective_from = "2026-10-14"
  changed.lines[1].case_price_minor = 5000
  changed.lines[1].catalog_version = "2"
  const updated = await saveOrder(db, 1, changed)
  assert.equal(updated.revision, 2)
  assert.deepEqual(await saveOrder(db, 0, invoiceFixture.version, command), created)
  const week = await previewWeek(db, created.order_id, "2026-10-12")
  assert.equal(week.total_minor, 14000)
  assert.deepEqual(week.lines.map((line) => line.case_price_minor), [4500, 5000])
  assert.deepEqual(week.lines.map((line) => line.catalog_version), ["1", "2"])
  const race = await Promise.allSettled([
    saveOrder(db, 2, { ...changed, notes: "writer one" }),
    saveOrder(db, 2, { ...changed, notes: "writer two" }),
  ])
  assert.equal(race.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal(race.filter((result) => result.status === "rejected").length, 1)
  const rows = await db.query("select count(*)::int as count from bridge.invoice_standing_order_versions")
  assert.equal(rows.rows[0].count, 3)
})

test("pause, resume and a separate sending hold retain historical cases", async (t) => {
  const db = await invoiceDatabase()
  t.after(() => db.close())
  const created = await saveOrder(db)
  const paused = { ...invoiceFixture.version, effective_from: "2026-10-14", paused: true, lines: [] }
  await saveOrder(db, 1, paused)
  const partial = await previewWeek(db, created.order_id, "2026-10-12")
  assert.equal(partial.total_minor, 9000)
  assert.equal(partial.dates[2].state, "paused")
  const held = { ...invoiceFixture.version, effective_from: "2026-10-14", sending_hold: true }
  await saveOrder(db, 2, held)
  const resumed = await previewWeek(db, created.order_id, "2026-10-12")
  assert.equal(resumed.total_minor, 13500)
  assert.equal(resumed.sending_hold, true)
  assert.equal(resumed.week_id, partial.week_id)
  assert.notEqual(resumed.snapshot_id, partial.snapshot_id)
  const saved = await db.query<{ document: unknown }>(
    "select document from bridge.invoice_weekly_snapshots where snapshot_id=$1", [partial.snapshot_id])
  assert.deepEqual(saved.rows[0].document, partial)
})

test("protected coverage and immutable identity prevent historical rewrites", async (t) => {
  const db = await invoiceDatabase()
  t.after(() => db.close())
  const identity = { ...invoiceFixture.order, protected_through: "2026-10-11" }
  const version = { ...invoiceFixture.version, effective_from: "2026-10-12" }
  const created = await saveOrder(db, 0, version, randomUUID(), identity)
  await assert.rejects(saveOrder(db, 1, { ...version, effective_from: "2026-10-11" },
    randomUUID(), identity), /invoice_protected_history/)
  await assert.rejects(previewWeek(db, created.order_id, "2026-10-05"), /invoice_protected_history/)
  await assert.rejects(saveOrder(db, 1, version, randomUUID(),
    { ...identity, protected_through: null }), /invoice_identity_conflict/)
  await assert.rejects(saveOrder(db, 1, version, randomUUID(),
    { ...identity, currency: "CAD" }), /invoice_identity_conflict/)
  const row = await db.query("select revision from bridge.invoice_standing_orders")
  assert.equal(row.rows[0].revision, 1)
})
