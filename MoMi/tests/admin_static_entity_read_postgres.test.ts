import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"

test("static entity reads preserve route selection, inactive and unauthorized results", async () => {
  const source = await readFile(new URL("../services/warehouse-read-api/src/read_entity.ts", import.meta.url), "utf8")
  const query = source.match(/sql<EntityReadRow\[\]>\x60([\s\S]*?)\x60/)?.[1]
  assert.ok(query)
  assert.doesNotMatch(query, /sql\(/)
  const db = new PGlite()
  const entity = "10000000-0000-4000-8000-000000000001"
  const token = "20000000-0000-4000-8000-000000000002"
  const contracts = [
    ["momi.payments.get_by_id.v1", "payments_by_id_v1", "payment"],
    ["momi.menu_entities.get_by_id.v1", "menu_entities_by_id_v1", "menu_item"],
    ["momi.employees.get_by_id.v1", "employees_by_id_v1", "employee"],
    ["momi.schedules.get_by_id.v1", "schedules_by_id_v1", "schedule"],
  ]
  try {
    await db.exec(`
      create schema momi_api;
      create table momi_api.read_view_registry (
        view_key text, contract_version integer, schema_name text,
        view_or_function_name text, active boolean);
      create function momi_api.consume_read_capability(bigint,text,uuid,uuid,uuid)
      returns bigint language sql as $$ select case
        when $5 = '${token}'::uuid then $1 else null end $$;
    `)
    for (const [key, view, type] of contracts) {
      await db.exec(`create view momi_api.${view} as select
        '${entity}'::uuid as entity_id, '${type}'::text as entity_type,
        1 as schema_version, '{"kind":"${type}"}'::jsonb as canonical_document,
        '{}'::jsonb as provenance, '{}'::jsonb as freshness`)
      await db.query("insert into momi_api.read_view_registry values($1,1,'momi_api',$2,true)",
        [key, view])
    }
    for (const [key, view, type] of contracts) {
      for (const mode of ["authorized", "unauthorized", "inactive"]) {
        await db.query("update momi_api.read_view_registry set active=$1 where view_key=$2",
          [mode !== "inactive", key])
        const bindings: Record<string, unknown> = {
          "input.work_id": "42", "contract.functionKey": key,
          "input.entity_id": entity, contractVersion: 1,
          "input.capability_token": mode === "unauthorized" ? entity : token,
          "contract.viewName": view,
        }
        const values: unknown[] = []
        const sql = query.replace(/\$\{([^}]+)\}/g, (_, expression: string) => {
          assert.ok(expression in bindings)
          values.push(bindings[expression])
          return "$" + values.length
        })
        const response = await db.query<Record<string, unknown>>(sql, values)
        assert.equal(response.rows.length, 1)
        const row = response.rows[0]
        assert.equal(row.contract_active, mode !== "inactive")
        assert.equal(row.work_id, mode === "unauthorized" ? null : 42)
        assert.equal(row.entity_type, mode === "authorized" ? type : null)
        assert.deepEqual(row.canonical_document,
          mode === "authorized" ? { kind: type } : null)
      }
    }
  } finally { await db.close() }
})
