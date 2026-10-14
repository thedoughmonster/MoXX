import assert from "node:assert/strict";
import test from "node:test";
import { calendarDatabase } from "./calendar_database.ts";
import { calendarMetadata, saveCalendar } from "./save_calendar.ts";
import { invoiceFixture } from "./fixture.ts";

test("calendar reader is scoped, complete, owner-only, and grants no raw relation access", async (t) => {
  const db = await calendarDatabase(); t.after(() => db.close());
  await saveCalendar(db);
  await saveCalendar(db, 0, invoiceFixture.version, { ...calendarMetadata, fulfillment: "pickup" }, undefined,
    { ...invoiceFixture.order, merchant_id: "another-merchant" });
  for (const role of ["anon", "authenticated", "service_role"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query("select bridge.invoice_calendar_snapshot_v1('dev','synthetic-merchant','synthetic-location')"), /permission denied/);
    await db.exec("reset role");
  }
  await db.exec("set role invoice_test_owner");
  const read = await db.query<any>("select bridge.invoice_calendar_snapshot_v1('dev','synthetic-merchant','synthetic-location') as document");
  assert.equal(read.rows[0].document.orders.length, 1);
  assert.equal(read.rows[0].document.snapshot_revision, 2);
  assert.equal(read.rows[0].document.orders[0].revisions[0].fulfillment, "delivery");
  const empty = await db.query<any>("select bridge.invoice_calendar_snapshot_v1('dev','missing-merchant','synthetic-location') as document");
  assert.deepEqual(empty.rows[0].document.orders, []);
  assert.equal(empty.rows[0].document.snapshot_revision, 1);
  await db.exec("reset role; set role service_role");
  await assert.rejects(db.query("select * from bridge.invoice_standing_order_versions"), /permission denied/);
  await assert.rejects(db.query("select bridge.invoice_calendar_version_guard_v1()"), /permission denied/);
  await db.exec("reset role; set role invoice_test_owner");
  assert.deepEqual((await db.query("select * from unrelated.fixture")).rows, [{ value: "preserved" }]);
  const policy = await db.query<any>("select enabled from bridge.invoice_policy_versions");
  assert.equal(policy.rows[0].enabled, false);
});

test("revision evidence cannot be edited or deleted, and calendar functions keep fixed search paths", async (t) => {
  const db = await calendarDatabase(); t.after(() => db.close());
  await saveCalendar(db);
  await assert.rejects(db.exec("update bridge.invoice_standing_order_versions set calendar_metadata=null"), /immutable_version/);
  await assert.rejects(db.exec("delete from bridge.invoice_standing_order_versions"), /immutable_version/);
  const functions = await db.query<any>(`select p.proname, p.proconfig from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace where n.nspname='bridge'
    and p.proname in ('invoice_save_standing_order_v2','invoice_calendar_snapshot_v1','invoice_calendar_version_guard_v1')`);
  assert.equal(functions.rows.length, 3);
  assert.ok(functions.rows.every((row: any) => row.proconfig.includes('search_path=""')));
});
