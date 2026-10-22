import assert from "node:assert/strict"
import test from "node:test"
import { createCronHistoryDatabase } from "./fixtures/create_cron_history_database.ts"

const migration = new URL(
  "../supabase/migrations/20261022172534_configure_thirty_day_cron_history_retention.sql",
  import.meta.url,
)

test("legacy governor executes seven-day retention and preserves thirty-one-day failures", async () => {
  const database = await createCronHistoryDatabase(migration)
  try {
    const policy = await database.query(`select phase, raw_retention::text,
      exception_retention::text, summary_retention::text
      from momi_cron_history.policy_control`)
    assert.deepEqual(policy.rows, [{ phase: "disarmed", raw_retention: "7 days",
      exception_retention: "365 days", summary_retention: "90 days" }])
    await database.exec(`
      insert into cron.job_run_details
        (runid, jobid, status, return_message, start_time, end_time) values
        (1, 1, 'succeeded', 'SELECT 1', now() - interval '31 days 1 second', now() - interval '31 days'),
        (2, 2, 'failed', 'fixture failure', now() - interval '31 days 1 second', now() - interval '31 days'),
        (3, 3, 'succeeded', 'SELECT 1', now() - interval '29 days 1 second', now() - interval '29 days');
      insert into momi_cron_history.governor_ticks (tick_id)
        values ('00000000-0000-4000-8000-000000000001');
      update momi_cron_history.policy_control set
        phase = 'canary', batch_size = 500, dry_run_complete = true;
    `)
    const batch = await database.query<{ result: { deleted: number } }>(`
      select momi_cron_history.run_batch_v1(
        '00000000-0000-4000-8000-000000000001', 500, false) as result`)
    assert.equal(batch.rows[0].result.deleted, 2)
    const remaining = await database.query("select runid::integer from cron.job_run_details order by runid")
    assert.deepEqual(remaining.rows, [{ runid: 2 }])
    const ledger = await database.query("select runid::integer from momi_cron_history.exception_ledger")
    assert.deepEqual(ledger.rows, [{ runid: 2 }])
  } finally { await database.close() }
})
