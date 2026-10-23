import assert from "node:assert/strict"
import test from "node:test"
import { createCronHistoryDatabase } from "./fixtures/create_cron_history_database.ts"

const migration = new URL(
  "../supabase/migrations/20261022172534_configure_thirty_day_cron_history_retention.sql",
  import.meta.url,
)

test("dry-run estimates preserve raw history and allow a subsequent retention profile choice", async () => {
  const database = await createCronHistoryDatabase(migration)
  try {
    await database.exec(`
      insert into cron.job_run_details
        (runid,jobid,status,return_message,start_time,end_time) values
        (1,1,'succeeded','SELECT 1',now()-interval '31 days 1 second',now()-interval '31 days'),
        (2,2,'failed','fixture failure',now()-interval '31 days 1 second',now()-interval '31 days');
      insert into momi_cron_history.governor_ticks (tick_id)
        values ('00000000-0000-4000-8000-000000000003');
      select momi_cron_history.configure_v1('dry_run',500,0,0,null);
    `)
    const batch = await database.query<{ result: {
      status: string, summarized: number, exceptions: number, deleted: number,
    } }>(`select momi_cron_history.run_batch_v1(
      '00000000-0000-4000-8000-000000000003',500,true) as result`)
    assert.equal(batch.rows[0].result.status, "dry_run")
    assert.equal(batch.rows[0].result.summarized, 1)
    assert.equal(batch.rows[0].result.exceptions, 1)
    assert.equal(batch.rows[0].result.deleted, 0)
    const persisted = await database.query(`select
      (select count(*)::integer from cron.job_run_details) as raw,
      (select count(*)::integer from momi_cron_history.exception_ledger) as exceptions,
      (select count(*)::integer from momi_cron_history.batch_summary_coverage) as coverage,
      (select cursor_runid::integer from momi_cron_history.scan_state) as cursor`)
    assert.deepEqual(persisted.rows, [{ raw: 2, exceptions: 0, coverage: 0, cursor: 0 }])
    await database.query("select momi_cron_history.configure_v1('paused',500,0,0,null)")
    const changed = await database.query(`select
      momi_cron_history.configure_retention_v1(30,null) as changed`)
    assert.deepEqual(changed.rows, [{ changed: true }])
    const policy = await database.query(`select completed_raw_retention::text,
      phase, dry_run_complete, canary_complete from momi_cron_history.policy_control`)
    assert.deepEqual(policy.rows, [{ completed_raw_retention: "30 days", phase: "paused",
      dry_run_complete: false, canary_complete: false }])
  } finally { await database.close() }
})
