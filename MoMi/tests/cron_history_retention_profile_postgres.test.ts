import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { createCronHistoryDatabase } from "./fixtures/create_cron_history_database.ts"

const migration = new URL(
  "../supabase/migrations/20261022172534_configure_thirty_day_cron_history_retention.sql",
  import.meta.url,
)

test("thirty-day profile removes eligible completed raw history and advances past protected rows", async () => {
  const database = await createCronHistoryDatabase(migration)
  try {
    await database.exec(await readFile(
      new URL("fixtures/cron_history_retention_rows.sql", import.meta.url), "utf8"))
    await database.query(`select momi_cron_history.configure_retention_v1(
      30, now() - interval '30 days')`)
    await database.exec(`
      insert into cron.job_run_details
        (runid, jobid, status, return_message, start_time, end_time)
      values (17,17,'succeeded','SELECT 1',now() - interval '31 days 1 second',now() - interval '31 days');
      insert into momi_cron_history.governor_ticks (tick_id)
        values ('00000000-0000-4000-8000-000000000002');
      update momi_cron_history.policy_control set
        phase = 'canary', batch_size = 500, dry_run_complete = true;
    `)
    const result = await database.query<{ result: {
      deleted: number, cursor_after: number, high_water_runid: number,
    } }>(`select momi_cron_history.run_batch_v1(
      '00000000-0000-4000-8000-000000000002', 500, false) as result`)
    assert.equal(result.rows[0].result.deleted, 2)
    assert.equal(result.rows[0].result.cursor_after, 16)
    assert.equal(result.rows[0].result.high_water_runid, 16)
    const remaining = await database.query("select runid::integer from cron.job_run_details order by runid")
    assert.deepEqual(remaining.rows, [
      { runid: 1 }, { runid: 4 }, { runid: 5 }, { runid: 6 }, { runid: 7 },
      { runid: 8 }, { runid: 9 }, { runid: 10 }, { runid: 11 }, { runid: 12 },
      { runid: 13 }, { runid: 14 }, { runid: 15 }, { runid: 16 }, { runid: 17 },
    ])
    const ledger = await database.query("select runid::integer from momi_cron_history.exception_ledger order by runid")
    assert.deepEqual(ledger.rows, [{ runid: 3 }])
    const coverage = await database.query(`select sum(run_count)::integer as covered
      from momi_cron_history.batch_summary_coverage`)
    assert.equal(coverage.rows[0].covered, 1)
    await database.query("select momi_cron_history.configure_v1('paused',500,0,0,null)")
    await assert.rejects(database.query("select momi_cron_history.configure_retention_v1(null,null)"),
      /retention profile must be selected before processing history/)
    const stillSelected = await database.query(`select completed_raw_retention::text
      from momi_cron_history.policy_control`)
    assert.deepEqual(stillSelected.rows, [{ completed_raw_retention: "30 days" }])
  } finally { await database.close() }
})
