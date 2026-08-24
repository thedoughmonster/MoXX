import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import postgres from "postgres"

const databaseUrl = process.env.WAREHOUSE_PROJECTION_SEARCH_PATH_DATABASE_URL
const ownerMigration = await readFile(
  "supabase/migrations/20260817185934_route_warehouse_projection_trigger_adapters_through_owner_contracts.sql",
  "utf8",
)
const migration = await readFile(
  "supabase/migrations/20260824152706_pin_warehouse_projection_batch_search_path.sql",
  "utf8",
)
const currentProcedure = ownerMigration.match(
  /create or replace procedure warehouse_projection\.process_delivery_batch\([\s\S]*?\n\$\$;/,
)?.[0]
const fixture = await readFile(
  "tests/fixtures/warehouse_projection_search_path_probe.sql",
  "utf8",
)

test("migration pins transaction-local resolution and preserves contracts", async () => {
  assert.match(migration,
    /create or replace procedure warehouse_projection\.process_delivery_batch/)
  assert.match(migration, /set_config\([^;]+true\);\s+started_at :=/)
  assert.equal((migration.match(
    /commit and chain;\s+perform pg_catalog\.set_config\([^;]+true\);/g,
  ) ?? []).length, 2)
  assert.match(migration, /target\.proconfig is not null/)
  assert.doesNotMatch(migration, /job\.active/)
  assert.match(migration, /edf46bc642f0a92e37ae19addec09a38/)
  assert.match(migration, /e3e1e4b28c45d66de115a8bc374e5995/)
  assert.doesNotMatch(migration, /alter procedure|set search_path\s*=/i)
  assert.doesNotMatch(migration, /\b(?:grant|revoke)\b/i)
  if (!databaseUrl) return
  assert.ok(currentProcedure)
  const admin = postgres(databaseUrl as string, { max: 1, prepare: false })
  const probeUrl = new URL(databaseUrl as string)
  probeUrl.pathname = "/mox188_search_path"
  await admin.unsafe("drop database if exists mox188_search_path with (force)")
  await admin.unsafe("create database mox188_search_path")
  const database = postgres(probeUrl.toString(), { max: 1, prepare: false })
  const metadataSql = `select procedure.prosrc as source,
    procedure.proconfig, procedure.proacl::text as acl,
    procedure.prosecdef, role.rolname as owner
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_roles as role on role.oid = procedure.proowner
    where procedure.oid = pg_catalog.to_regprocedure(
      'warehouse_projection.process_delivery_batch(integer,integer)')`
  try {
    await database.unsafe(fixture.split("__PROCEDURE__").join(currentProcedure))
    const before = (await database.unsafe(metadataSql))[0]
    const cron = await database.unsafe(`select jobname, active, schedule, command
      from cron.job`)
    await database.unsafe(
      "call warehouse_projection.process_delivery_batch(6, 60)")
    const beforeOutput = (await database.unsafe(
      "select claims, projections from mox379_probe.state"))[0]
    assert.deepEqual(beforeOutput, { claims: 1, projections: 1 })
    await database.unsafe(`update mox379_probe.state
      set claims=0, projections=0, observed_paths=array[]::text[]`)

    const stale = migration.replace(
      "edf46bc642f0a92e37ae19addec09a38",
      "00000000000000000000000000000000",
    )
    await assert.rejects(database.unsafe(stale),
      /MOX-188 target procedure metadata drifted/)
    assert.deepEqual((await database.unsafe(metadataSql))[0], before)

    await database.unsafe(migration)
    await database.unsafe(`create schema hostile;
      set search_path = hostile, pg_catalog, public;`)
    await database.unsafe(
      "call warehouse_projection.process_delivery_batch(6, 60)")
    const afterOutput = (await database.unsafe(
      "select claims, projections from mox379_probe.state"))[0]
    assert.deepEqual(afterOutput, beforeOutput)
    const observed = (await database.unsafe<{ observed_paths: string[] }[]>(
      "select observed_paths from mox379_probe.state"))[0]
    assert.deepEqual(observed.observed_paths,
      ["pg_catalog", "pg_catalog", "pg_catalog"])
    const after = (await database.unsafe(metadataSql))[0]
    assert.equal(after.proconfig, null)
    assert.equal(after.prosecdef, false)
    assert.equal(after.owner, "postgres")
    assert.equal(after.acl, before.acl)
    assert.notEqual(after.source, before.source)
    assert.deepEqual(await database.unsafe(
      "select jobname, active, schedule, command from cron.job"), cron)
    assert.equal(
      (await database.unsafe(
        "select current_setting('search_path') as path"))[0].path,
      "hostile, pg_catalog, public",
    )

    await database.unsafe(currentProcedure)
    assert.deepEqual((await database.unsafe(metadataSql))[0], before)
  } finally {
    await database.end()
    await admin.unsafe("drop database mox188_search_path with (force)")
    await admin.end()
  }
})
