import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import test from "node:test"
import { emptyDatabase } from "./empty_database.ts"
import { saveCalendar } from "./save_calendar.ts"
import { discoverServices } from "../../../scripts/architecture/discover_services.ts"
import { loadTargetAuthoritySnapshot } from "../../../scripts/constitution/load_target_authority_snapshot.ts"
import { findNewMigrationAuthorityViolations } from "../../../scripts/migrations/find_new_migration_authority_violations.ts"

const provenance = JSON.parse(readFileSync(new URL("../provenance.json", import.meta.url), "utf8"))
const sql = readFileSync(new URL("../../../" + provenance.migration, import.meta.url), "utf8")
const verify = readFileSync(new URL("../verify-bootstrap.sql", import.meta.url), "utf8")

test("reviewed business SQL and recorded migration bytes are pinned; native owner validation passes", async () => {
  assert.equal(createHash("sha256").update(sql).digest("hex"), provenance.migration_sha256)
  const body = sql.slice(sql.indexOf("-- Source: supabase/migrations/"), sql.indexOf("-- Immediate bootstrap verification"))
  assert.equal(createHash("sha256").update(body).digest("hex"), provenance.unchanged_business_sql_sha256)
  assert.doesNotMatch(sql, /^\s*(grant |create role |alter role |alter default privileges |commit;)/im)
  const services = await discoverServices("services")
  const violations = findNewMigrationAuthorityViolations(new Map(), new Map([[provenance.migration, sql]]),
    services, loadTargetAuthoritySnapshot())
  assert.deepEqual(violations, [])
})

test("owner without superuser or CREATEROLE installs exact empty objects; verification is read-only", async (t) => {
  const db = await emptyDatabase(); t.after(() => db.close())
  await db.exec("begin;" + sql + "commit;")
  await db.exec("begin read only;" + verify + "commit;")
  assert.deepEqual((await db.query("select rolcreaterole, rolsuper from pg_roles where rolname=current_user")).rows,
    [{ rolcreaterole: false, rolsuper: false }])
  assert.equal((await db.query("select 1 from pg_roles where rolname='svc_wholesale_invoicing'")).rows.length, 0)
  assert.deepEqual((await db.query("select * from unrelated.fixture")).rows, [{ value: "preserved" }])
})

test("rollback removes the whole bootstrap; retry preserves already committed order/version evidence", async (t) => {
  const db = await emptyDatabase(); t.after(() => db.close())
  await db.exec("begin;" + sql + "rollback;")
  assert.deepEqual((await db.query("select to_regnamespace('bridge') as schema")).rows, [{ schema: null }])
  await db.exec("begin;" + sql + "commit;")
  await saveCalendar(db)
  await assert.rejects(db.exec("begin;" + sql + "commit;"), /already exists/)
  await db.exec("rollback;")
  assert.equal((await db.query("select * from bridge.invoice_standing_orders")).rows.length, 1)
  assert.equal((await db.query("select * from bridge.invoice_standing_order_versions")).rows.length, 1)
})

test("unexpected default grants fail closed without changing defaults or unrelated objects", async (t) => {
  const db = await emptyDatabase(); t.after(() => db.close())
  await db.exec("alter default privileges grant select on tables to unrelated_runtime;")
  const before = (await db.query("select defaclacl::text from pg_default_acl where defaclrole=current_user::regrole")).rows
  await assert.rejects(db.exec("begin;" + sql + "commit;"), /unexpected_delegated_access/)
  await db.exec("rollback;")
  assert.deepEqual((await db.query("select to_regnamespace('bridge') as schema")).rows, [{ schema: null }])
  assert.deepEqual((await db.query("select defaclacl::text from pg_default_acl where defaclrole=current_user::regrole")).rows, before)
  assert.deepEqual((await db.query("select * from unrelated.fixture")).rows, [{ value: "preserved" }])
})
