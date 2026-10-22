import assert from "node:assert/strict"
import test from "node:test"
import { createCronHistoryDatabase } from "./fixtures/create_cron_history_database.ts"

const migration = new URL(
  "../supabase/migrations/20261022172534_configure_thirty_day_cron_history_retention.sql",
  import.meta.url,
)

test("accepted fixed drain enters rolling retention and revisits released holds without duplicate coverage", async () => {
  const database = await createCronHistoryDatabase(migration)
  try {
    await database.exec(`insert into cron.job_run_details
      (runid,jobid,status,return_message,start_time,end_time) values
      (1,1,'succeeded','SELECT 1',now()-interval '31 days 1 second',now()-interval '31 days'),
      (2,2,'failed','failure',now()-interval '31 days 1 second',now()-interval '31 days');
      insert into momi_cron_history.incident_holds(runid,hold_key,reason_code)
      values(2,'fixture-hold','incident');`)
    await database.query(`select momi_cron_history.configure_retention_v1(
      30,now()-interval '30 days')`)
    await assert.rejects(database.query("select momi_cron_history.configure_retention_v1(30,null)"))
    await database.exec(`insert into momi_cron_history.governor_ticks(tick_id)
      values('00000000-0000-4000-8000-000000000011');
      update momi_cron_history.policy_control set phase='drain',batch_size=500,
        dry_run_complete=true,canary_complete=true;`)
    const first = await database.query<{ result: { deleted: number, initial_drain_complete: boolean } }>(`
      select momi_cron_history.run_batch_v1(
        '00000000-0000-4000-8000-000000000011',500,false) as result`)
    assert.equal(first.rows[0].result.deleted, 1)
    assert.equal(first.rows[0].result.initial_drain_complete, true)
    assert.deepEqual((await database.query(`select phase, initial_cutoff,
      initial_high_water_runid from momi_cron_history.policy_control`)).rows,
      [{ phase: "steady", initial_cutoff: null, initial_high_water_runid: null }])
    await database.query("select momi_cron_history.release_hold_v1(2,'fixture-release')")
    await database.exec(`insert into momi_cron_history.governor_ticks(tick_id)
      values('00000000-0000-4000-8000-000000000012');
      update momi_cron_history.policy_control set phase='steady',batch_size=500,
        dry_run_complete=true,canary_complete=true,last_batch_at=now()-interval '1 minute';`)
    const second = await database.query<{ result: { deleted: number, cursor_after: number } }>(`
      select momi_cron_history.run_batch_v1(
        '00000000-0000-4000-8000-000000000012',500,false) as result`)
    assert.equal(second.rows[0].result.deleted, 1)
    assert.equal(second.rows[0].result.cursor_after, 0)
    assert.deepEqual((await database.query("select runid::int from momi_cron_history.exception_ledger")).rows,
      [{ runid: 2 }])
    assert.deepEqual((await database.query("select sum(run_count)::int as count from momi_cron_history.minute_summaries")).rows,
      [{ count: 1 }])
    assert.deepEqual((await database.query("select count(*)::int as count from cron.job_run_details")).rows,
      [{ count: 0 }])
  } finally { await database.close() }
})
