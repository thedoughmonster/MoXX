import assert from "node:assert/strict"
import test from "node:test"
import { createCronHistoryDatabase } from "./fixtures/create_cron_history_database.ts"

const migration = new URL(
  "../supabase/migrations/20261022172534_configure_thirty_day_cron_history_retention.sql",
  import.meta.url,
)

test("rolling scans freeze each cycle boundary and revisit newly completed gaps on the next cycle", async () => {
  const database = await createCronHistoryDatabase(migration)
  try {
    await database.exec(`insert into cron.job_run_details(runid,jobid,status)
      values(1,1,'running'),(2,2,'running'),(3,3,'running');
      insert into momi_cron_history.governor_ticks(tick_id) values
      ('00000000-0000-4000-8000-000000000021'),
      ('00000000-0000-4000-8000-000000000022'),
      ('00000000-0000-4000-8000-000000000023');`)
    await database.query("select momi_cron_history.configure_retention_v1(30,null)")
    await database.exec(`update momi_cron_history.policy_control set phase='steady',
      batch_size=500,dry_run_complete=true,canary_complete=true`)
    const first = await database.query<{ result: { cursor_after: number, high_water_runid: number } }>(`
      select momi_cron_history.run_batch_v1(
        '00000000-0000-4000-8000-000000000021',2,false) as result`)
    assert.equal(first.rows[0].result.cursor_after, 2)
    assert.equal(first.rows[0].result.high_water_runid, 3)
    await database.exec(`insert into cron.job_run_details(runid,jobid,status)
      values(4,4,'running'),(5,5,'running');
      update cron.job_run_details set status='succeeded',return_message='SELECT 1',
        start_time=now()-interval '31 days 1 second',end_time=now()-interval '31 days'
      where runid=1;
      update momi_cron_history.policy_control set last_batch_at=now()-interval '1 minute'`)
    const second = await database.query<{ result: { cursor_after: number, high_water_runid: number, deleted: number } }>(`
      select momi_cron_history.run_batch_v1(
        '00000000-0000-4000-8000-000000000022',2,false) as result`)
    assert.equal(second.rows[0].result.high_water_runid, 3)
    assert.equal(second.rows[0].result.cursor_after, 0)
    assert.equal(second.rows[0].result.deleted, 0)
    await database.exec(`update momi_cron_history.policy_control
      set last_batch_at=now()-interval '1 minute'`)
    const third = await database.query<{ result: { cursor_after: number, high_water_runid: number, deleted: number } }>(`
      select momi_cron_history.run_batch_v1(
        '00000000-0000-4000-8000-000000000023',5,false) as result`)
    assert.equal(third.rows[0].result.high_water_runid, 5)
    assert.equal(third.rows[0].result.cursor_after, 0)
    assert.equal(third.rows[0].result.deleted, 1)
    assert.deepEqual((await database.query("select runid::int from cron.job_run_details order by runid")).rows,
      [{ runid: 2 }, { runid: 3 }, { runid: 4 }, { runid: 5 }])
  } finally { await database.close() }
})
