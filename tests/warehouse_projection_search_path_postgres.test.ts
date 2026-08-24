import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import postgres from "postgres"

const databaseUrl = process.env.WAREHOUSE_PROJECTION_SEARCH_PATH_DATABASE_URL
const ownerMigration = await readFile(
  "supabase/migrations/20260817185934_route_warehouse_projection_trigger_adapters_through_owner_contracts.sql",
  "utf8",
)
const currentProcedure = ownerMigration.match(
  /create or replace procedure warehouse_projection\.process_delivery_batch\([\s\S]*?\n\$\$;/,
)?.[0]
const fixture = await readFile(
  "tests/fixtures/warehouse_projection_search_path_probe.sql",
  "utf8",
)

test("transaction-local search path preserves delivery commits", {
  skip: !databaseUrl,
}, async () => {
  assert.ok(currentProcedure)
  const admin = postgres(databaseUrl as string, { max: 1, prepare: false })
  const probeUrl = new URL(databaseUrl as string)
  probeUrl.pathname = "/mox379_search_path"
  await admin.unsafe("drop database if exists mox379_search_path with (force)")
  await admin.unsafe("create database mox379_search_path")
  const database = postgres(probeUrl.toString(), { max: 1, prepare: false })
  try {
    await database.unsafe(fixture.split("__PROCEDURE__").join(currentProcedure))
    const metadata = await database.unsafe<{
      proconfig: string[] | null, acl: string, source: string
    }[]>(`select proconfig, proacl::text as acl, prosrc as source
      from pg_catalog.pg_proc where oid = pg_catalog.to_regprocedure(
        'warehouse_projection.process_delivery_batch(integer,integer)')`)
    const cron = await database.unsafe<{ command: string }[]>(
      "select command from mox379_probe.cron_contract")

    await database.unsafe(
      "call warehouse_projection.process_delivery_batch(6, 60)")
    let state = await database.unsafe<{
      claims: number, projections: number
    }[]>("select claims, projections from mox379_probe.state")
    assert.deepEqual(state[0], { claims: 1, projections: 1 })

    await database.unsafe("update mox379_probe.state set claims=0, projections=0")
    await database.unsafe(`alter procedure
      warehouse_projection.process_delivery_batch(integer, integer)
      set search_path = pg_catalog`)
    const attached = await database.unsafe<{
      proconfig: string[], acl: string, source: string
    }[]>(`select proconfig, proacl::text as acl, prosrc as source
      from pg_catalog.pg_proc where oid = pg_catalog.to_regprocedure(
        'warehouse_projection.process_delivery_batch(integer,integer)')`)
    assert.deepEqual(attached[0].proconfig, ["search_path=pg_catalog"])
    assert.equal(attached[0].acl, metadata[0].acl)
    assert.equal(attached[0].source, metadata[0].source)
    await assert.rejects(database.unsafe(
      "call warehouse_projection.process_delivery_batch(6, 60)"), {
      code: "2D000", message: "invalid transaction termination",
    })
    state = await database.unsafe(
      "select claims, projections from mox379_probe.state")
    assert.deepEqual(state[0], { claims: 0, projections: 0 })

    await database.unsafe(`alter procedure
      warehouse_projection.process_delivery_batch(integer, integer)
      reset search_path`)
    await database.unsafe(`create schema hostile;
      create function hostile.clock_timestamp() returns timestamptz
      language plpgsql as $fn$
      begin raise exception 'hostile clock resolved'; end;
      $fn$;`)
    const hardened = currentProcedure
      .replace("started_at timestamptz := clock_timestamp();",
        "started_at timestamptz;")
      .replace("\nbegin\n  if", `\nbegin
  perform pg_catalog.set_config('search_path', 'pg_catalog', true);
  started_at := pg_catalog.clock_timestamp();
  if`)
      .replaceAll("commit and chain;", `commit and chain;
    perform pg_catalog.set_config('search_path', 'pg_catalog', true);`)
    await database.unsafe(hardened)
    await database.unsafe("set search_path = hostile, pg_catalog, public")
    await database.unsafe(
      "call warehouse_projection.process_delivery_batch(6, 60)")
    state = await database.unsafe(
      "select claims, projections from mox379_probe.state")
    assert.deepEqual(state[0], { claims: 1, projections: 1 })
    const after = await database.unsafe<{
      path: string, proconfig: string[] | null, acl: string, source: string
    }[]>(`select current_setting('search_path') as path,
      procedure.proconfig, procedure.proacl::text as acl,
      procedure.prosrc as source from pg_catalog.pg_proc as procedure
      where procedure.oid = pg_catalog.to_regprocedure(
        'warehouse_projection.process_delivery_batch(integer,integer)')`)
    assert.equal(after[0].path, "hostile, pg_catalog, public")
    assert.equal(after[0].proconfig, null)
    assert.equal(after[0].acl, metadata[0].acl)
    assert.notEqual(after[0].source, metadata[0].source)
    assert.equal(cron.length, 1)
    assert.equal(cron[0].command,
      "call warehouse_projection.process_delivery_batch(6, 60)")
  } finally {
    await database.end()
    await admin.unsafe("drop database mox379_search_path with (force)")
    await admin.end()
  }
})
