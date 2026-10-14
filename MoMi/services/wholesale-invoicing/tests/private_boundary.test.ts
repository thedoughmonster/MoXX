import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { invoiceDatabase } from "./database.ts"
import { invoiceFixture } from "./fixture.ts"
import { saveOrder } from "./save.ts"
import { previewWeek } from "./preview.ts"

test("runtime access stays disabled; policy, helpers and unrelated objects remain safe", async (t) => {
  const db = await invoiceDatabase()
  t.after(() => db.close())
  const created = await saveOrder(db)
  assert.equal((await previewWeek(db, created.order_id, "2026-10-12")).enabled, false)
  const permissions = await db.query<{ allowed: boolean }>(`select has_function_privilege(r.oid,p.oid,'execute') as allowed
    from pg_roles r cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where r.rolname in ('anon','authenticated','service_role') and n.nspname='bridge'`)
  assert.equal(permissions.rows.length, 18)
  assert.ok(permissions.rows.every((row) => !row.allowed))
  await db.exec("reset role; set role service_role")
  await assert.rejects(db.exec("select * from bridge.invoice_standing_orders"), /permission denied/)
  await assert.rejects(db.exec("update bridge.invoice_policy_versions set enabled=true"), /permission denied/)
  await db.exec("reset role; set role invoice_test_owner")
  await assert.rejects(db.exec("update bridge.invoice_policy_versions set enabled=true"), /check constraint/)
  assert.equal((await db.query("select 1 from pg_roles where rolname='svc_wholesale_invoicing'")).rows.length, 0)
  const routines = await db.query<{ definer: boolean; config: string[] }>(`select p.prosecdef as definer, p.proconfig as config
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='bridge'`)
  assert.equal(routines.rows.filter((row) => row.definer).length, 4)
  assert.ok(routines.rows.every((row) => row.config.includes('search_path=""')))
  assert.deepEqual((await db.query("select * from unrelated.fixture")).rows, [{ value: "preserved" }])
})

test("invalid complete requests roll back without partial orders or line loss", async (t) => {
  const db = await invoiceDatabase()
  t.after(() => db.close())
  const badVersions = [
    { ...invoiceFixture.version, enabled: true },
    { ...invoiceFixture.version, effective_from: "2026-02-30" },
    { ...invoiceFixture.version, effective_from: "infinity" },
    { ...invoiceFixture.version, paused: null },
    { ...invoiceFixture.version, notes: "x".repeat(1001) },
    { ...invoiceFixture.version, lines: [] },
    { ...invoiceFixture.version, lines: [invoiceFixture.version.lines[0], invoiceFixture.version.lines[0]] },
    { ...invoiceFixture.version, lines: Array(101).fill(invoiceFixture.version.lines[0]) },
  ]
  for (const patch of [{ case_quantity: 1.5 }, { weekday: 0 }, { case_price_minor: -1 }, { case_price_minor: 0.5 },
    { case_price_minor: 1000000001 }, { case_price_minor: null }, { name: "" },
    { catalog_snapshot: null }, { currency: "CAD" }]) {
    badVersions.push({ ...invoiceFixture.version,
      lines: [{ ...invoiceFixture.version.lines[0], ...patch }] } as typeof invoiceFixture.version)
  }
  for (const version of badVersions) await assert.rejects(
    saveOrder(db, 0, version as typeof invoiceFixture.version), /invoice_|date.time field/)
  for (const identity of [
    { ...invoiceFixture.order, currency: "usd" },
    { ...invoiceFixture.order, client_id: "" },
    { ...invoiceFixture.order, protected_through: "2026-10-12" },
    { ...invoiceFixture.order, enabled: true },
  ]) await assert.rejects(saveOrder(db, 0, invoiceFixture.version, randomUUID(), identity), /invoice_/)
  const rows = await db.query("select count(*)::int as count from bridge.invoice_standing_orders")
  assert.equal(rows.rows[0].count, 0)
})

test("unsafe totals fail without persisting a partial weekly identity", async (t) => {
  const db = await invoiceDatabase()
  t.after(() => db.close())
  const version = { ...invoiceFixture.version, lines: Array.from({ length: 100 }, (_, index) => ({
    ...invoiceFixture.version.lines[0], catalog_item_id: "case-" + index,
    case_quantity: 100000, case_price_minor: 1000000000,
  })) }
  const created = await saveOrder(db, 0, version)
  await assert.rejects(previewWeek(db, created.order_id, "2026-10-12"), /invoice_total_out_of_range/)
  const rows = await db.query("select count(*)::int as count from bridge.invoice_weeks")
  assert.equal(rows.rows[0].count, 0)
})
