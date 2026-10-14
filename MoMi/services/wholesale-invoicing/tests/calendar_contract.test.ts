import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { calendarDatabase } from "./calendar_database.ts";
import { calendarMetadata, saveCalendar } from "./save_calendar.ts";
import { invoiceFixture } from "./fixture.ts";
import { saveOrder } from "./save.ts";
import { previewWeek } from "./preview.ts";

test("calendar save v2 retains stable identity, immutable command replay and revision fencing", async (t) => {
  const db = await calendarDatabase(); t.after(() => db.close());
  const command = randomUUID();
  const created = await saveCalendar(db, 0, invoiceFixture.version, calendarMetadata, command);
  assert.deepEqual(await saveCalendar(db, 0, invoiceFixture.version, calendarMetadata, command), created);
  await assert.rejects(saveCalendar(db, 0, invoiceFixture.version,
    { ...calendarMetadata, fulfillment: "pickup" }, command), /invoice_command_conflict/);
  await assert.rejects(saveCalendar(db, 0), /invoice_revision_conflict/);
  const next = await saveCalendar(db, 1, { ...invoiceFixture.version, sending_hold: true });
  assert.equal(next.order_id, created.order_id);
  assert.equal(next.revision, 2);
  await assert.rejects(saveOrder(db, 2), /invoice_calendar_save_v2_required/);
  const original = await db.query<any>("select request_document, calendar_metadata from bridge.invoice_standing_order_versions where revision=1");
  assert.deepEqual(original.rows[0].request_document.calendar, calendarMetadata);
  assert.deepEqual(original.rows[0].calendar_metadata, calendarMetadata);
});

test("snapshot preserves dated pause/resume/hold/discontinuation and exact positive scheduled weekdays", async (t) => {
  const db = await calendarDatabase(); t.after(() => db.close());
  const base = structuredClone(invoiceFixture.version);
  base.lines.push({ ...base.lines[0], catalog_item_id: "synthetic-second-case" });
  const created = await saveCalendar(db, 0, base);
  await saveCalendar(db, 1, { ...base, effective_from: "2026-10-14", paused: true });
  await saveCalendar(db, 2, { ...base, effective_from: "2026-10-15", sending_hold: true });
  await assert.rejects(saveCalendar(db, 3, base, { ...calendarMetadata, discontinued: true }), /requires_pause/);
  const command = randomUUID();
  const stopped = { ...base, effective_from: "2026-10-16", paused: true };
  const metadata = { ...calendarMetadata, discontinued: true };
  const result = await saveCalendar(db, 3, stopped, metadata, command);
  assert.deepEqual(await saveCalendar(db, 3, stopped, metadata, command), result);
  await assert.rejects(saveCalendar(db, 4), /invoice_discontinued_order/);
  await assert.rejects(saveOrder(db, 4), /invoice_discontinued_order/);
  const rows = await db.query<any>("select bridge.invoice_calendar_snapshot_v1('dev','synthetic-merchant','synthetic-location') as document");
  const snapshot = rows.rows[0].document;
  assert.equal(snapshot.snapshot_revision, 5);
  assert.equal(snapshot.complete, true);
  assert.equal(snapshot.orders[0].order_id, created.order_id);
  assert.deepEqual(snapshot.orders[0].revisions.map((r: any) => r.state), ["active", "paused", "active", "discontinued"]);
  assert.deepEqual(snapshot.orders[0].revisions.map((r: any) => r.weekdays), [[1, 3], [1, 3], [1, 3], [1, 3]]);
  assert.equal(snapshot.orders[0].revisions[2].sending_hold, true);
  assert.ok(Math.abs(Date.now() - Date.parse(snapshot.as_of)) < 10_000);
  const preview = await previewWeek(db, created.order_id, "2026-10-12");
  assert.equal(preview.enabled, false);
  assert.equal(preview.sending_hold, true);
  assert.equal(preview.total_minor, 18000); // Monday only; two 2-case lines, unaffected by hold
});

test("legacy revisions are never assumed deliverable and cannot be relabeled by replay", async (t) => {
  const db = await calendarDatabase(); t.after(() => db.close());
  const command = randomUUID();
  await saveOrder(db, 0, invoiceFixture.version, command);
  await assert.rejects(saveCalendar(db, 0, invoiceFixture.version, calendarMetadata, command), /invoice_command_conflict/);
  await assert.rejects(db.query("select bridge.invoice_calendar_snapshot_v1('dev','synthetic-merchant','synthetic-location')"),
    /invoice_calendar_metadata_missing/);
  const legacy = await db.query<any>("select calendar_metadata from bridge.invoice_standing_order_versions");
  assert.equal(legacy.rows[0].calendar_metadata, null);
});

test("calendar metadata validation and protected invoice history roll back whole commands", async (t) => {
  const db = await calendarDatabase(); t.after(() => db.close());
  for (const metadata of [null, {}, { ...calendarMetadata, fulfillment: "unknown" },
    { ...calendarMetadata, customer_name: "bad\nname" }, { ...calendarMetadata, surprise: true }]) {
    await assert.rejects(saveCalendar(db, 0, invoiceFixture.version, metadata as any), /invoice_/);
  }
  assert.equal((await db.query<any>("select count(*)::int as n from bridge.invoice_standing_orders")).rows[0].n, 0);
  const identity = { ...invoiceFixture.order, protected_through: "2026-10-11" };
  await assert.rejects(saveCalendar(db, 0, invoiceFixture.version, calendarMetadata, randomUUID(), identity), /protected_history/);
});
