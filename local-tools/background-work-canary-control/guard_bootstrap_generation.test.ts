import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import { parse } from "pgsql-ast-parser"
import { DEADMAN_EXPIRY_PLACEHOLDER } from "./deadman_command_constants.ts"
import { generateGuardBootstrapSql } from "./generate_guard_bootstrap_sql.ts"
import { VALID_GUARD_BOOTSTRAP_INPUT } from "./guard_bootstrap.test_fixture.ts"
import {
  DEADMAN_TEMPLATE_TAG,
  GUARD_BOOTSTRAP_DO_TAG,
} from "./guard_bootstrap_constants.ts"

test("bootstrap transaction is byte deterministic and structurally parseable", () => {
  const sql = generateGuardBootstrapSql(VALID_GUARD_BOOTSTRAP_INPUT)
  assert.equal(sql, generateGuardBootstrapSql(structuredClone(VALID_GUARD_BOOTSTRAP_INPUT)))
  assert.equal(Buffer.byteLength(sql), 9_399)
  assert.equal(createHash("sha256").update(sql).digest("hex"),
    "66f93a3ae8109f839229762b3bdad0f694d133cde495117cbf9f2a1ff79d0c3a")
  const masked = sql.replace(
    `${DEADMAN_TEMPLATE_TAG}${VALID_GUARD_BOOTSTRAP_INPUT.deadmanCommand}${DEADMAN_TEMPLATE_TAG}`,
    "'validated-deadman-template'",
  ).replaceAll(GUARD_BOOTSTRAP_DO_TAG, () => "$$")
  assert.deepEqual(parse(masked).map((statement) => statement.type), [
    "begin", "set", "set", "do", "select", "commit",
  ])
})

test("bootstrap uses one database clock and exact 30-second materialization", () => {
  const sql = generateGuardBootstrapSql(VALID_GUARD_BOOTSTRAP_INPUT)
  const outer = sql.replace(VALID_GUARD_BOOTSTRAP_INPUT.deadmanCommand, "DEADMAN_TEMPLATE")
  assert.equal((outer.match(/clock_timestamp\(\)/g) ?? []).length, 1)
  assert.equal((outer.match(/interval '30 seconds'/g) ?? []).length, 1)
  assert.match(outer, /select clock_timestamp\(\) into database_now;/)
  assert.match(outer, /expiry_at := database_now \+ interval '30 seconds';/)
  assert.match(outer, /to_char\(expiry_at at time zone 'UTC'/)
  assert.equal((VALID_GUARD_BOOTSTRAP_INPUT.deadmanCommand.match(
    new RegExp(DEADMAN_EXPIRY_PLACEHOLDER, "g"),
  ) ?? []).length, 1)
  assert.equal((outer.match(new RegExp(DEADMAN_EXPIRY_PLACEHOLDER, "g")) ?? []).length, 4)
  assert.doesNotMatch(sql, /Date\.|new Date|CURRENT_TIMESTAMP|localtimestamp/i)
})

test("bootstrap rejects noncanonical templates and all caller injection surfaces", () => {
  const values = [
    { ...VALID_GUARD_BOOTSTRAP_INPUT, runId: "run-x'; select 1; --" },
    { ...VALID_GUARD_BOOTSTRAP_INPUT, generationSha256: "A".repeat(64) },
    { ...VALID_GUARD_BOOTSTRAP_INPUT, projectRef: "production-project" },
    { ...VALID_GUARD_BOOTSTRAP_INPUT, guardName: "other" },
    { ...VALID_GUARD_BOOTSTRAP_INPUT, guardSchedule: "10 seconds" },
    { ...VALID_GUARD_BOOTSTRAP_INPUT, advisoryLockKey: "other" },
    { ...VALID_GUARD_BOOTSTRAP_INPUT, deadmanCommand: "select now();" },
    { ...VALID_GUARD_BOOTSTRAP_INPUT, deadmanCommand:
      VALID_GUARD_BOOTSTRAP_INPUT.deadmanCommand + GUARD_BOOTSTRAP_DO_TAG },
    { ...VALID_GUARD_BOOTSTRAP_INPUT, deadmanCommand:
      VALID_GUARD_BOOTSTRAP_INPUT.deadmanCommand.replace(
        DEADMAN_EXPIRY_PLACEHOLDER,
        `${DEADMAN_EXPIRY_PLACEHOLDER}${DEADMAN_TEMPLATE_TAG}`,
      ) },
    { ...VALID_GUARD_BOOTSTRAP_INPUT, targetJobs:
      VALID_GUARD_BOOTSTRAP_INPUT.targetJobs.map((job, index) =>
        index === 0 ? { ...job, schedule: "3 seconds'; select 1; --" } : job) },
    { ...VALID_GUARD_BOOTSTRAP_INPUT, expiryUtc: "2026-08-02T00:00:00Z" },
    { ...VALID_GUARD_BOOTSTRAP_INPUT, extra: "field" },
  ]
  for (const value of values) assert.throws(() => generateGuardBootstrapSql(value))
})

test("outer bootstrap surface has one schedule call and no broader mutation", () => {
  const sql = generateGuardBootstrapSql(VALID_GUARD_BOOTSTRAP_INPUT)
  const outer = sql.replace(VALID_GUARD_BOOTSTRAP_INPUT.deadmanCommand, "DEADMAN_TEMPLATE")
  assert.equal((outer.match(/cron\.schedule/g) ?? []).length, 1)
  assert.match(outer, /pg_try_advisory_xact_lock/)
  assert.match(outer,
    /encode\(extensions\.digest\(\s*convert_to\(j\.command, 'UTF8'\), 'sha256'\), 'hex'\)/)
  assert.doesNotMatch(outer, /\bsha256\s*\(/)
  assert.match(outer,
    /momi:deadman:generation:run-20260802-abcdef:a{64}/)
  assert.doesNotMatch(outer, /cron\.(alter_job|unschedule)|\b(update|insert|delete)\b/i)
  assert.doesNotMatch(outer, /\b(create|drop|truncate|grant|revoke)\b/i)
  assert.doesNotMatch(outer, /https?:|payload|credential|password|token|pg_net|net\./i)
  assert.doesNotMatch(outer, /job_run_details\s*(?:where.*?)?\bdelete\b/is)
  assert.match(outer, /begin;[\s\S]*commit;\n$/)
})
