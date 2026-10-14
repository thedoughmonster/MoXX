import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { calendarDatabase } from "./calendar_database.ts"

test("manifest matches the exact installed objects while runtime permissions remain deferred", async (t) => {
  const manifest = JSON.parse(await readFile(new URL("../service.json", import.meta.url), "utf8"))
  const db = await calendarDatabase()
  t.after(() => db.close())
  const owned = manifest.owned_dataset
  assert.equal(owned.private_schema, undefined)
  assert.equal(owned.db_role, undefined)
  const relations = await db.query<{ name: string }>(`select n.nspname || '.' || c.relname as name
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='bridge' and c.relkind in ('r','p','v','m','f','S')
      and c.relname <> 'unrelated_fixture' order by name`)
  const relationNames = relations.rows.map((row) => row.name)
  assert.equal(relationNames.length, 7)
  assert.deepEqual([...owned.private_relations].sort(), relationNames)
  assert.deepEqual([...manifest.database.read].sort(), relationNames)
  assert.deepEqual([...manifest.database.write].sort(), relationNames)
  const routines = await db.query<{ name: string; signature: string; callable: boolean }>(`select
    n.nspname || '.' || p.proname as name, oidvectortypes(p.proargtypes) as signature,
    has_function_privilege('service_role',p.oid,'execute') as callable
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='bridge' order by name`)
  assert.deepEqual(routines.rows, [
    { name: 'bridge.invoice_calendar_snapshot_v1', signature: 'text, text, text', callable: false },
    { name: 'bridge.invoice_calendar_version_guard_v1', signature: '', callable: false },
    { name: 'bridge.invoice_preview_week_v1', signature: 'uuid, date', callable: false },
    { name: 'bridge.invoice_save_standing_order_v1', signature: 'uuid, integer, jsonb, jsonb', callable: false },
    { name: 'bridge.invoice_save_standing_order_v2', signature: 'uuid, integer, jsonb, jsonb, jsonb', callable: false },
    { name: 'bridge.invoice_validate_standing_order_v1', signature: 'jsonb, jsonb', callable: false },
  ])
  assert.deepEqual([...owned.private_routines].sort(), routines.rows.map((row) => row.name))
  assert.deepEqual(owned.public_routine_commands, [
    { contract: 'momi.wholesale_invoicing.standing_order.save.v1', routine: 'bridge.invoice_save_standing_order_v1' },
    { contract: 'momi.wholesale_invoicing.week.preview.v1', routine: 'bridge.invoice_preview_week_v1' },
    { contract: 'momi.wholesale_invoicing.standing_order.save.v2', routine: 'bridge.invoice_save_standing_order_v2' },
  ])
  const contracts = owned.public_routine_commands.map((entry: {contract: string}) => entry.contract).sort()
  assert.deepEqual([...owned.public_commands].sort(), contracts)
  assert.deepEqual(owned.public_routine_reads, [
    { contract: 'momi.wholesale_invoicing.calendar.read.v1', routine: 'bridge.invoice_calendar_snapshot_v1' },
  ])
  assert.deepEqual(owned.public_reads, ['momi.wholesale_invoicing.calendar.read.v1'])
  assert.deepEqual([...manifest.contracts.provides].sort(), [...contracts, ...owned.public_reads].sort())
  const foreignKeys = await db.query<{ source: string; target: string }>(`select
    c.conrelid::regclass::text as source, c.confrelid::regclass::text as target
    from pg_constraint c join pg_namespace n on n.oid=c.connamespace
    where n.nspname='bridge' and c.contype='f'`)
  assert.ok(foreignKeys.rows.every((row) => relationNames.includes(row.source) && relationNames.includes(row.target)))
  assert.deepEqual(await db.query("select * from unrelated.fixture").then((r) => r.rows), [{value:'preserved'}])
  for (const empty of [manifest.contracts.consumes, manifest.network.outbound_hosts,
    manifest.secrets, manifest.functions, manifest.configuration, manifest.runtime_dependencies,
    manifest.approved_packages, manifest.deployment.owns, manifest.deployment.depends_on,
    owned.emitted_events]) assert.deepEqual(empty, [])
})
