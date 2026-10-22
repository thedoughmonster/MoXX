import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { createCronHistoryDatabase } from "./fixtures/create_cron_history_database.ts"

const migration = new URL(
  "../supabase/migrations/20261022172534_configure_thirty_day_cron_history_retention.sql",
  import.meta.url,
)

test("provider wrapper preserves drain completion and legacy dry-run/canary pauses", async () => {
  for (const phase of ["dry_run", "canary", "drain"]) {
    const database = await createCronHistoryDatabase(migration)
    try {
      await database.exec(`insert into cron.job_run_details
        (runid,jobid,status,return_message,start_time,end_time) values
        (1,1,'succeeded','SELECT 1',now()-interval '31 days 1 second',now()-interval '31 days')`)
      if (phase === "drain") {
        await database.query(`select momi_cron_history.configure_retention_v1(
          30,now()-interval '30 days')`)
      }
      // Seed prior acceptance only; the provider warning trigger and health gate are real.
      await database.exec(`update momi_cron_history.policy_control
        set dry_run_complete=true,canary_complete=true`)
      await database.query("select momi_cron_history.configure_v1($1,500,0,0,null)", [phase])
      await database.exec(await readFile(
        new URL("fixtures/cron_history_provider_samples.sql", import.meta.url), "utf8"))
      const baseline = await database.query<{ gate: { state: string } }>(`
        select momi_cron_history.health_gate_v1() as gate`)
      assert.equal(baseline.rows[0].gate.state, "ready", phase)
      const outcome = await database.query<{ result: {
        ok: boolean, phase: string, disposition: string,
        receipt: { deleted: number, initial_drain_complete?: boolean },
      } }>(`select momi_cron_history.record_provider_sample_v1(
        '00000000-0000-4000-8000-000000000101',
        '00000000-0000-4000-8000-000000000201',
        now(),960,864,20,0,0,20,1,false,true) as result`)
      const expectedPhase = phase === "drain" ? "steady" : "paused"
      assert.equal(outcome.rows[0].result.ok, true, phase)
      assert.equal(outcome.rows[0].result.phase, expectedPhase, phase)
      assert.equal(outcome.rows[0].result.disposition, phase === "dry_run" ? "dry_run" : "completed", phase)
      assert.equal(outcome.rows[0].result.receipt.deleted, phase === "dry_run" ? 0 : 1, phase)
      if (phase === "drain") assert.equal(outcome.rows[0].result.receipt.initial_drain_complete, true)
      const policy = await database.query(`select phase, initial_cutoff, initial_high_water_runid,
        dry_run_complete, canary_complete from momi_cron_history.policy_control`)
      assert.deepEqual(policy.rows, [{ phase: expectedPhase, initial_cutoff: null,
        initial_high_water_runid: null, dry_run_complete: true, canary_complete: true }], phase)
      const tick = await database.query(`select tick_status, result->>'phase' as phase
        from momi_cron_history.governor_ticks
        where tick_id='00000000-0000-4000-8000-000000000101'`)
      assert.deepEqual(tick.rows, [{ tick_status: "completed", phase: expectedPhase }], phase)
    } finally { await database.close() }
  }
})
