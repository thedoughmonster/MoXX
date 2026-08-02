import assert from "node:assert/strict"
import { test } from "node:test"
import { VALID_GUARD_HEARTBEAT_INPUT } from "./combined_heartbeat.test_fixture.ts"
import { generateCleanupSql } from "./generate_cleanup_sql.ts"
import { generateCombinedHeartbeatSql } from "./generate_combined_heartbeat_sql.ts"
import { generateGuardBootstrapSql } from "./generate_guard_bootstrap_sql.ts"
import { generateGuardHeartbeatSql } from "./generate_guard_heartbeat_sql.ts"
import { generateRollbackSql } from "./generate_rollback_sql.ts"
import { VALID_GUARD_BOOTSTRAP_INPUT } from "./guard_bootstrap.test_fixture.ts"
import { VALID_RECOVERY_CONTROL_INPUT } from "./recovery_control.test_fixture.ts"

const advisory = "pg_try_advisory_xact_lock(hashtextextended(" +
  "'momi:#328:development-recovery-canary', 0))"
const heartbeat = generateGuardHeartbeatSql(VALID_GUARD_HEARTBEAT_INPUT)
const combinedFast = generateCombinedHeartbeatSql({
  ...VALID_GUARD_HEARTBEAT_INPUT, includeResource: false,
})
const combinedResource = generateCombinedHeartbeatSql({
  ...VALID_GUARD_HEARTBEAT_INPUT, includeResource: true,
})

test("every control transaction uses no explicit row-locking clause", () => {
  const generated = [
    generateGuardBootstrapSql(VALID_GUARD_BOOTSTRAP_INPUT), heartbeat,
    combinedFast, combinedResource,
    generateRollbackSql(VALID_RECOVERY_CONTROL_INPUT),
    generateCleanupSql(VALID_RECOVERY_CONTROL_INPUT),
  ]
  for (const sql of generated) {
    assert.doesNotMatch(sql,
      /\bfor\s+(?:no\s+key\s+update|key\s+share|update|share)\b/i)
    assert.equal(sql.split(advisory).length - 1, 1)
  }
})

test("bootstrap keeps bounded preconditions before schedule and strict readback", () => {
  const sql = generateGuardBootstrapSql(VALID_GUARD_BOOTSTRAP_INPUT)
  const fragments = [
    advisory, "perform 1 from cron.job where jobid in (2, 3, 4, 11);",
    "select count(*) = 4 and bool_and(case j.jobid", "guard_count <> 0",
    "cron.schedule(", "into strict readback_job_id", "momi_guard_bootstrap_readback",
  ]
  const positions = fragments.map((fragment) => sql.indexOf(fragment))
  assert.ok(positions.every((position) => position >= 0))
  assert.deepEqual([...positions].sort((a, b) => a - b), positions)
})

test("heartbeat and combined variants read, alter, then strictly read back", () => {
  for (const sql of [heartbeat, combinedFast, combinedResource]) {
    const fragments = [
      advisory, "guard_count <> 1", "into strict current_name",
      "perform 1 from cron.job where jobid in (2, 3, 4, 11);",
      "select count(*) = 4 and bool_and(case j.jobid", "current_expiry_at <= database_now",
      "cron.alter_job(job_id := 12, command := materialized_next)",
      "into strict readback_name", "momi_guard_heartbeat_readback",
    ]
    const positions = fragments.map((fragment) => sql.indexOf(fragment))
    assert.ok(positions.every((position) => position >= 0))
    assert.deepEqual([...positions].sort((a, b) => a - b), positions)
  }
})

test("rollback preserves exact validation, upstream-first mutation, and readbacks", () => {
  const sql = generateRollbackSql(VALID_RECOVERY_CONTROL_INPUT)
  const fragments = [
    advisory, "perform 1 from cron.job where jobid in (2, 3, 4, 11);",
    "select count(*) = 4 and bool_and(case j.jobid", "into strict guard_name",
    "cron.alter_job(job_id := 3", "cron.alter_job(job_id := 2",
    "cron.alter_job(job_id := 11", "cron.alter_job(job_id := 4",
    "momi_rollback_target_readback", "cron.alter_job(job_id := 12",
    "momi_rollback_guard_readback",
  ]
  const positions = fragments.map((fragment) => sql.indexOf(fragment))
  assert.ok(positions.every((position) => position >= 0))
  assert.deepEqual([...positions].sort((a, b) => a - b), positions)
})

test("cleanup validates exact inactivity before unschedule and absence readback", () => {
  const sql = generateCleanupSql(VALID_RECOVERY_CONTROL_INPUT)
  const fragments = [
    advisory, "perform 1 from cron.job where jobid in (2, 3, 4, 11);",
    "select count(*) = 4 and bool_and(case j.jobid", "into strict guard_name",
    "momi_cleanup_guard_active", "cron.unschedule(12)", "momi_cleanup_readback",
  ]
  const positions = fragments.map((fragment) => sql.indexOf(fragment))
  assert.ok(positions.every((position) => position >= 0))
  assert.deepEqual([...positions].sort((a, b) => a - b), positions)
})
