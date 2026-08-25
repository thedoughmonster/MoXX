import assert from "node:assert/strict"
import { test } from "node:test"
import { VALID_GUARD_HEARTBEAT_INPUT } from "./combined_heartbeat.test_fixture.ts"
import { generateGuardBootstrapSql } from "./generate_guard_bootstrap_sql.ts"
import { generateGuardHeartbeatSql } from "./generate_guard_heartbeat_sql.ts"
import { VALID_GUARD_BOOTSTRAP_INPUT } from "./guard_bootstrap.test_fixture.ts"
import { CHILD_HARD_TIMEOUT_MS } from "./process_constants.ts"
import { CRON_RUN_EVIDENCE_WINDOW_ROWS } from "./sample_constants.ts"
import { LIFECYCLE_DEADLINE_MS } from "./schedule_constants.ts"

test("control SQL bounds the retained-history timeout mechanism", () => {
  const bootstrap = generateGuardBootstrapSql(VALID_GUARD_BOOTSTRAP_INPUT)
  const heartbeat = generateGuardHeartbeatSql(VALID_GUARD_HEARTBEAT_INPUT)
  const retainedRows = 972_272
  const modeledMillisecondsPerRow = 0.011
  assert.ok(retainedRows * modeledMillisecondsPerRow > CHILD_HARD_TIMEOUT_MS)
  assert.ok(CRON_RUN_EVIDENCE_WINDOW_ROWS * modeledMillisecondsPerRow < 200)
  assert.equal(CHILD_HARD_TIMEOUT_MS, 10_000)
  assert.equal(LIFECYCLE_DEADLINE_MS, 12_000)
  for (const [sql, startRunId, gapError, boundedPredicates, mutation] of [
    [bootstrap, VALID_GUARD_BOOTSTRAP_INPUT.startCronRunId,
      "momi_guard_bootstrap_history_gap", 4, "scheduled_job_id := cron.schedule("],
    [heartbeat, VALID_GUARD_HEARTBEAT_INPUT.startCronRunId,
      "momi_guard_heartbeat_history_gap", 2,
      "perform cron.alter_job(job_id := 12, command := materialized_next)"],
  ] as const) {
    assert.match(sql, /select coalesce\(max\(runid\), 0\)::bigint into latest_run_id/)
    assert.match(sql, /select coalesce\(max\(runid\), 0\)::bigint into final_run_id/)
    assert.match(sql, new RegExp(`latest_run_id < ${startRunId}`))
    assert.match(sql, new RegExp(
      `latest_run_id - ${startRunId} > ${CRON_RUN_EVIDENCE_WINDOW_ROWS}`,
    ))
    assert.match(sql, new RegExp(gapError))
    assert.equal((sql.match(new RegExp(
      `where runid > ${startRunId} and runid <= (?:latest|final)_run_id`, "g",
    )) ?? []).length, boundedPredicates)
    const positions = ["into latest_run_id", "runid <= latest_run_id", mutation,
      "into final_run_id", "runid <= final_run_id", "into strict readback"]
      .map((fragment) => sql.indexOf(fragment))
    assert.ok(positions.every((position) => position >= 0))
    assert.deepEqual([...positions].sort((left, right) => left - right), positions)
    assert.doesNotMatch(sql,
      /from cron\.job_run_details\s+where status = 'running'/)
  }
  const rows = [{ runId: 1_000, target: false }, { runId: 1_001, target: true }]
  const capturedMax = 1_000
  assert.equal(rows.filter((row) => row.runId <= capturedMax && row.target).length, 0)
  const finalMax = Math.max(...rows.map((row) => row.runId))
  assert.equal(rows.filter((row) => row.runId <= finalMax && row.target).length, 1)
})
