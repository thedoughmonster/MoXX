import assert from "node:assert/strict"
import test from "node:test"
import { createCronHistoryDatabase } from "./fixtures/create_cron_history_database.ts"

const migration = new URL(
  "../supabase/migrations/20261022172534_configure_thirty_day_cron_history_retention.sql",
  import.meta.url,
)

test("retention profile is opt-in and invalid configuration cannot mutate policy", async () => {
  const database = await createCronHistoryDatabase(migration)
  try {
    const defaults = await database.query(`select completed_raw_retention,
      raw_retention::text, exception_retention::text, summary_retention::text
      from momi_cron_history.policy_control`)
    assert.deepEqual(defaults.rows, [{ completed_raw_retention: null,
      raw_retention: "7 days", exception_retention: "365 days",
      summary_retention: "90 days" }])
    assert.deepEqual((await database.query(`select has_function_privilege(
      'service_role', 'momi_cron_history.configure_retention_v1(integer,timestamptz)',
      'EXECUTE') as allowed`)).rows, [{ allowed: false }])
    await database.query("select momi_cron_history.configure_v1('disarmed',500,0,0,null)")
    const before = await database.query("select to_jsonb(p) as policy from momi_cron_history.policy_control p")
    for (const days of [-1, 0, 7, 29, 31, 365]) {
      await assert.rejects(database.query(
        "select momi_cron_history.configure_retention_v1($1,null)", [days]),
      /invalid completed-history retention/)
      assert.deepEqual((await database.query(
        "select to_jsonb(p) as policy from momi_cron_history.policy_control p")).rows,
      before.rows)
    }
    for (const args of ["30,'infinity'", "30,'-infinity'", "30,now()", "null,'2020-01-01'"]) {
      await assert.rejects(database.query(
        `select momi_cron_history.configure_retention_v1(${args})`),
      /invalid completed-history retention/)
      assert.deepEqual((await database.query(
        "select to_jsonb(p) as policy from momi_cron_history.policy_control p")).rows,
      before.rows)
    }
    await database.exec(`update momi_cron_history.policy_control set
      phase = 'paused', dry_run_complete = true, canary_complete = true,
      accepted_rate_receipt = 'previous-profile-receipt'`)
    await database.query("select momi_cron_history.configure_retention_v1(30,null)")
    const configured = await database.query(`select phase, completed_raw_retention::text,
      dry_run_complete, canary_complete, accepted_rate_receipt,
      raw_retention::text, exception_retention::text
      from momi_cron_history.policy_control`)
    assert.deepEqual(configured.rows, [{ phase: "paused", completed_raw_retention: "30 days",
      dry_run_complete: false, canary_complete: false, accepted_rate_receipt: null,
      raw_retention: "7 days", exception_retention: "365 days" }])
    await assert.rejects(database.query("select momi_cron_history.configure_v1('canary',500,0,0,null)"),
      /canary requires dry-run receipt/)
    await assert.rejects(database.query("select momi_cron_history.configure_v1('drain',500,0,0,null)"),
      /drain requires canary receipt/)
  } finally { await database.close() }
})
