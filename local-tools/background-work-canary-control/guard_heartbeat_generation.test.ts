import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import { parse } from "pgsql-ast-parser"
import { DEADMAN_EXPIRY_PLACEHOLDER } from "./deadman_command_constants.ts"
import { VALID_DEADMAN_INPUT } from "./deadman_command.test_fixture.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import { generateGuardHeartbeatSql } from "./generate_guard_heartbeat_sql.ts"
import {
  CURRENT_DEADMAN_TEMPLATE_TAG,
  GUARD_HEARTBEAT_DO_TAG,
  NEXT_DEADMAN_TEMPLATE_TAG,
} from "./guard_heartbeat_constants.ts"
import { VALID_GUARD_HEARTBEAT_INPUT } from "./guard_heartbeat.test_fixture.ts"

test("heartbeat transaction is deterministic and structurally parseable", () => {
  const sql = generateGuardHeartbeatSql(VALID_GUARD_HEARTBEAT_INPUT)
  assert.equal(sql, generateGuardHeartbeatSql(structuredClone(VALID_GUARD_HEARTBEAT_INPUT)))
  assert.equal(Buffer.byteLength(sql), 16_320)
  assert.equal(createHash("sha256").update(sql).digest("hex"),
    "c87d3d8dc2edbd04cfab73931690936fcafbb78faf87cff15af6121245916055")
  const current = generateDeadmanCommand(VALID_DEADMAN_INPUT)
  const masked = sql
    .replace(`${CURRENT_DEADMAN_TEMPLATE_TAG}${current}${CURRENT_DEADMAN_TEMPLATE_TAG}`,
      "'validated-current-template'")
    .replace(`${NEXT_DEADMAN_TEMPLATE_TAG}${VALID_GUARD_HEARTBEAT_INPUT.nextDeadmanCommand}${NEXT_DEADMAN_TEMPLATE_TAG}`,
      "'validated-next-template'")
    .replaceAll(GUARD_HEARTBEAT_DO_TAG, () => "$$")
  assert.deepEqual(parse(masked).map((statement) => statement.type), [
    "begin", "set", "set", "do", "select", "commit",
  ])
})

test("heartbeat captures one DB clock and materializes exactly DB time plus 30s", () => {
  const sql = generateGuardHeartbeatSql(VALID_GUARD_HEARTBEAT_INPUT)
  const outer = sql.replace(generateDeadmanCommand(VALID_DEADMAN_INPUT), "CURRENT")
    .replace(VALID_GUARD_HEARTBEAT_INPUT.nextDeadmanCommand, "NEXT")
  assert.equal((outer.match(/clock_timestamp\(\)/g) ?? []).length, 1)
  assert.equal((outer.match(/interval '30 seconds'/g) ?? []).length, 1)
  assert.match(outer, /select clock_timestamp\(\) into database_now;/)
  assert.match(outer, /next_expiry_at := database_now \+ interval '30 seconds';/)
  assert.equal((VALID_GUARD_HEARTBEAT_INPUT.nextDeadmanCommand.match(
    new RegExp(DEADMAN_EXPIRY_PLACEHOLDER, "g"),
  ) ?? []).length, 1)
})

test("heartbeat accepts no SQL, clock, expiry, identifier, tag, or extra input", () => {
  const input = VALID_GUARD_HEARTBEAT_INPUT
  const invalid = [
    { ...input, runId: "run-x'; select 1; --" },
    { ...input, guardJobId: 0 },
    { ...input, guardJobId: 12.5 },
    { ...input, currentGenerationSha256: input.nextGenerationSha256 },
    { ...input, nextGenerationSha256: "A".repeat(64) },
    { ...input, nextDeadmanCommand: "select now();" },
    { ...input, nextDeadmanCommand: input.nextDeadmanCommand + GUARD_HEARTBEAT_DO_TAG },
    { ...input, nextDeadmanCommand: input.nextDeadmanCommand.replace(
      DEADMAN_EXPIRY_PLACEHOLDER, `${DEADMAN_EXPIRY_PLACEHOLDER}${NEXT_DEADMAN_TEMPLATE_TAG}`) },
    { ...input, guardName: "other" },
    { ...input, targetJobs: input.targetJobs.map((job, index) =>
      index === 0 ? { ...job, commandMd5: "0".repeat(32) } : job) },
    { ...input, expiryUtc: "2026-08-02T00:00:00Z" },
    { ...input, extra: "field" },
  ]
  for (const value of invalid) assert.throws(() => generateGuardHeartbeatSql(value))
})

test("outer heartbeat mutates only the exact guard command once", () => {
  const sql = generateGuardHeartbeatSql(VALID_GUARD_HEARTBEAT_INPUT)
  const outer = sql.replace(generateDeadmanCommand(VALID_DEADMAN_INPUT), "CURRENT")
    .replace(VALID_GUARD_HEARTBEAT_INPUT.nextDeadmanCommand, "NEXT")
  assert.equal((outer.match(/cron\.alter_job/g) ?? []).length, 1)
  assert.match(outer, /cron\.alter_job\(job_id := 12, command := materialized_next\)/)
  assert.match(outer, /momi:deadman:generation:run-20260802-abcdef:a{64}/)
  assert.match(outer, /momi:deadman:generation:run-20260802-abcdef:d{64}/)
  assert.doesNotMatch(outer, /active\s*:=|cron\.(schedule|unschedule)/i)
  assert.doesNotMatch(outer, /^\s*(update|insert|delete|create|drop|truncate|grant|revoke)\b/im)
  assert.doesNotMatch(outer, /https?:|payload|credential|password|token|pg_net|net\./i)
  assert.doesNotMatch(outer, /\bprod(?:uction)?\b/i)
  assert.match(outer,
    /encode\(extensions\.digest\(\s*convert_to\(j\.command, 'UTF8'\), 'sha256'\), 'hex'\)/)
  assert.doesNotMatch(outer, /\bsha256\s*\(/)
})
