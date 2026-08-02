import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import { parse } from "pgsql-ast-parser"
import { generateCleanupSql } from "./generate_cleanup_sql.ts"
import { generateRollbackSql } from "./generate_rollback_sql.ts"
import {
  CLEANUP_DO_TAG,
  ROLLBACK_DO_TAG,
} from "./recovery_control_constants.ts"
import { VALID_RECOVERY_CONTROL_INPUT } from "./recovery_control.test_fixture.ts"

test("rollback and cleanup transactions are deterministic and parseable", () => {
  const rollback = generateRollbackSql(VALID_RECOVERY_CONTROL_INPUT)
  const cleanup = generateCleanupSql(VALID_RECOVERY_CONTROL_INPUT)
  assert.equal(Buffer.byteLength(rollback), 4_304)
  assert.equal(createHash("sha256").update(rollback).digest("hex"),
    "8a41ca5b2c1ea0cc9de52b1dc07a9672c2bfb804c9784cefc9049e38cc6dec4a")
  assert.equal(Buffer.byteLength(cleanup), 3_623)
  assert.equal(createHash("sha256").update(cleanup).digest("hex"),
    "be5e7ccaf1f8466d8d4453af6acd6007c73a04ecb2ec698f1df7ef4e6810a8cf")
  for (const [sql, tag] of [[rollback, ROLLBACK_DO_TAG], [cleanup, CLEANUP_DO_TAG]]) {
    assert.deepEqual(parse(sql.replaceAll(tag, () => "$$")).map((item) => item.type),
      ["begin", "set", "set", "do", "with", "commit"])
  }
})

test("rollback deactivates exact fixed IDs upstream-first and guard last", () => {
  const sql = generateRollbackSql(VALID_RECOVERY_CONTROL_INPUT)
  const calls = [3, 2, 11, 4].map((id) =>
    sql.indexOf(`cron.alter_job(job_id := ${id}, active := false)`))
  assert.ok(calls.every((index) => index > 0))
  assert.deepEqual([...calls].sort((a, b) => a - b), calls)
  const guard = sql.indexOf("cron.alter_job(job_id := 12, active := false)")
  assert.ok(guard > calls.at(-1)!)
  assert.ok(sql.indexOf("momi_rollback_target_identity") < calls[0])
  assert.ok(sql.indexOf("momi_rollback_guard_identity") < calls[0])
  assert.equal((sql.match(/cron\.alter_job/g) ?? []).length, 5)
  assert.doesNotMatch(sql, /cron\.(schedule|unschedule)/)
})

test("cleanup requires inactive targets and exact inactive guard before unschedule", () => {
  const sql = generateCleanupSql(VALID_RECOVERY_CONTROL_INPUT)
  const unschedule = sql.indexOf("cron.unschedule(12)")
  assert.ok(sql.indexOf("momi_cleanup_target_active") < unschedule)
  assert.ok(sql.indexOf("momi_cleanup_guard_active") < unschedule)
  assert.equal((sql.match(/cron\.unschedule/g) ?? []).length, 1)
  assert.doesNotMatch(sql, /cron\.(alter_job|schedule)/)
  assert.match(sql, /guard_name_count = 0 and guard_id_count = 0 then return/)
})

test("recovery SQL cannot broaden identities or mutate unrelated state", () => {
  for (const sql of [
    generateRollbackSql(VALID_RECOVERY_CONTROL_INPUT),
    generateCleanupSql(VALID_RECOVERY_CONTROL_INPUT),
  ]) {
    assert.match(sql, /pg_try_advisory_xact_lock/)
    assert.doesNotMatch(sql,
      /^\s*(update|insert|delete|create|drop|truncate|grant|revoke)\b/im)
    assert.doesNotMatch(sql, /https?:|payload|credential|password|token|pg_net|net\./i)
    assert.doesNotMatch(sql, /job_run_details|\bprod(?:uction)?\b/i)
  }
})

test("recovery input rejects repository, project, target, identifier, and extras", () => {
  const input = VALID_RECOVERY_CONTROL_INPUT
  const invalid = [
    { ...input, projectRef: "prod" },
    { ...input, guardJobId: 0 },
    { ...input, guardName: "other" },
    { ...input, repository: { ...input.repository, branch: "prod" } },
    { ...input, repository: { ...input.repository, headSha: "x".repeat(40) } },
    { ...input, targetJobs: input.targetJobs.slice(0, 3) },
    { ...input, targetJobs: input.targetJobs.map((job, index) =>
      index === 0 ? { ...job, jobName: "x'; delete; --" } : job) },
    { ...input, extra: true },
  ]
  for (const value of invalid) {
    assert.throws(() => generateRollbackSql(value))
    assert.throws(() => generateCleanupSql(value))
  }
})
