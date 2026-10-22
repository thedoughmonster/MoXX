import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { buildRetentionTransaction } from "../scripts/release/retention/build_transaction.ts"
import { retentionMigrations, retentionVersions } from "../scripts/release/retention/policy.ts"
import type { RetentionApproval } from "../scripts/release/retention/types.ts"
import { retentionReleaseDatabase } from "./fixtures/retention_release_database.ts"

const snapshot = await readFile(new URL("../scripts/release/retention/snapshot.sql", import.meta.url), "utf8")
const sources = await Promise.all(retentionVersions.prod.map(async (version) => {
  const pin = retentionMigrations[version]
  return { version, name: pin.file.split("/").at(-1)!.slice(15, -4),
    sql: await readFile(new URL(`../${pin.file}`, import.meta.url), "utf8") }
}))

test("bounded install preserves unknown history and all raw logs; replay is refused", async () => {
  const db = await retentionReleaseDatabase()
  try {
    const before = (await db.query<{ ledger_sha256: string; objects_sha256: string }>(snapshot)).rows[0]
    const approval = { before, migrations: [...retentionVersions.prod],
      expires_at: new Date(Date.now()+60000).toISOString() } as RetentionApproval
    await db.exec(buildRetentionTransaction(approval, sources, snapshot))
    assert.deepEqual((await db.query("select version from supabase_migrations.schema_migrations order by version")).rows,
      ["20260805081324","20260805122000","20261014090216","20261022172534"].map((version) => ({version})))
    assert.deepEqual((await db.query("select name,statements from supabase_migrations.schema_migrations where version='20261014090216'")).rows,
      [{name:"existing_external_capability",statements:["select 1"]}])
    assert.deepEqual((await db.query("select phase,completed_raw_retention from momi_cron_history.policy_control")).rows,
      [{phase:"disarmed",completed_raw_retention:null}])
    assert.deepEqual((await db.query("select runid from cron.job_run_details")).rows,[{runid:1}])
    await assert.rejects(db.exec(buildRetentionTransaction(approval,sources,snapshot)), /snapshot expired or changed/)
    await db.exec("rollback")
    assert.equal((await db.query("select * from supabase_migrations.schema_migrations")).rows.length,4)
  } finally { await db.close() }
})

test("SQL error rolls back both earlier migration DDL and its genuine history record", async () => {
  const db = await retentionReleaseDatabase()
  try {
    const before = (await db.query(snapshot)).rows[0]
    const approval = {before,migrations:[...retentionVersions.prod],
      expires_at:new Date(Date.now()+60000).toISOString()} as RetentionApproval
    const broken = sources.map((source,index)=>index===1?{...source,sql:"select missing_retention_fixture_function();"}:source)
    await assert.rejects(db.exec(buildRetentionTransaction(approval,broken,snapshot)), /missing_retention_fixture_function/)
    await db.exec("rollback")
    assert.deepEqual((await db.query("select to_regnamespace('momi_cron_history') as schema")).rows,[{schema:null}])
    assert.equal((await db.query("select * from supabase_migrations.schema_migrations")).rows.length,1)
    assert.equal((await db.query("select * from cron.job_run_details")).rows.length,1)
  } finally { await db.close() }
})

test("expiry and changed before-state abort before installing any object", async () => {
  const db = await retentionReleaseDatabase()
  try {
    const before = (await db.query(snapshot)).rows[0]
    for (const [expires_at,altered] of [["2026-09-01T00:00:00Z",before],
      [new Date(Date.now()+60000).toISOString(),{...before,ledger_sha256:"0".repeat(64)}]] as const) {
      const approval = {before:altered,migrations:[...retentionVersions.prod],expires_at} as RetentionApproval
      await assert.rejects(db.exec(buildRetentionTransaction(approval,sources,snapshot)), /snapshot expired or changed/)
      await db.exec("rollback")
      assert.equal((await db.query("select * from supabase_migrations.schema_migrations")).rows.length,1)
    }
  } finally { await db.close() }
})
