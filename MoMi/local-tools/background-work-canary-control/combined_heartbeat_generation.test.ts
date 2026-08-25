import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import { parse } from "pgsql-ast-parser"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import { generateCombinedHeartbeatSql } from "./generate_combined_heartbeat_sql.ts"
import {
  VALID_GUARD_HEARTBEAT_INPUT,
} from "./combined_heartbeat.test_fixture.ts"
import { VALID_DEADMAN_INPUT } from "./deadman_command.test_fixture.ts"
import {
  CURRENT_DEADMAN_TEMPLATE_TAG,
  GUARD_HEARTBEAT_DO_TAG,
  NEXT_DEADMAN_TEMPLATE_TAG,
} from "./guard_heartbeat_constants.ts"

test("fast-only and resource heartbeat variants are byte deterministic", () => {
  const fast = generateCombinedHeartbeatSql({
    ...VALID_GUARD_HEARTBEAT_INPUT, includeResource: false,
  })
  const resource = generateCombinedHeartbeatSql({
    ...VALID_GUARD_HEARTBEAT_INPUT, includeResource: true,
  })
  assert.equal(Buffer.byteLength(fast), 23_936)
  assert.equal(createHash("sha256").update(fast).digest("hex"),
    "c88cf437591e698b96e56590b09a3d3c6c3593376e927427507d61aebf67bf48")
  assert.equal(Buffer.byteLength(resource), 26_601)
  assert.equal(createHash("sha256").update(resource).digest("hex"),
    "ad855e32aa5f75185fcbf99590baa50982bd20b3daff7b685904f95ff4e94ec0")
  assert.equal(fast, generateCombinedHeartbeatSql({
    ...structuredClone(VALID_GUARD_HEARTBEAT_INPUT), includeResource: false,
  }))
  const current = generateDeadmanCommand(VALID_DEADMAN_INPUT)
  for (const [sql, expectedResource] of [[fast, false], [resource, true]] as const) {
    const masked = sql
      .replace(`${CURRENT_DEADMAN_TEMPLATE_TAG}${current}${CURRENT_DEADMAN_TEMPLATE_TAG}`,
        "'CURRENT'")
      .replace(`${NEXT_DEADMAN_TEMPLATE_TAG}${VALID_GUARD_HEARTBEAT_INPUT.nextDeadmanCommand}${NEXT_DEADMAN_TEMPLATE_TAG}`,
        "'NEXT'")
      .replaceAll(GUARD_HEARTBEAT_DO_TAG, () => "$$")
    assert.deepEqual(parse(masked).map((statement) => statement.type),
      ["begin", "set", "set", "do", "with", "commit"])
    assert.equal(masked.includes("resource_envelope as ("), expectedResource)
  }
})

test("combined variants accept only the exact resource boolean extension", () => {
  for (const value of [
    { ...VALID_GUARD_HEARTBEAT_INPUT },
    { ...VALID_GUARD_HEARTBEAT_INPUT, includeResource: "false" },
    { ...VALID_GUARD_HEARTBEAT_INPUT, includeResource: false, baseline: 1 },
    { ...VALID_GUARD_HEARTBEAT_INPUT, includeResource: false, timestamp: "now" },
  ]) assert.throws(() => generateCombinedHeartbeatSql(value))
})

test("sample observation derives from the single heartbeat DB clock", () => {
  const sql = generateCombinedHeartbeatSql({
    ...VALID_GUARD_HEARTBEAT_INPUT, includeResource: true,
  })
  const outer = sql.replace(generateDeadmanCommand(VALID_DEADMAN_INPUT), "CURRENT")
    .replace(VALID_GUARD_HEARTBEAT_INPUT.nextDeadmanCommand, "NEXT")
  assert.equal((outer.match(/clock_timestamp\(\)/g) ?? []).length, 1)
  assert.match(outer,
    /substring\(j\.command from 'expiry_at constant timestamptz := timestamptz ''\(\[\^''\]\+\)'''\)::timestamptz\n    - interval '30 seconds' as observed_at/)
  assert.equal((outer.match(/select observed_at from heartbeat_clock/g) ?? []).length, 2)
})

test("combined sample tail is read-only after the one guard command alteration", () => {
  const sql = generateCombinedHeartbeatSql({
    ...VALID_GUARD_HEARTBEAT_INPUT, includeResource: true,
  })
  const outer = sql.replace(generateDeadmanCommand(VALID_DEADMAN_INPUT), "CURRENT")
    .replace(VALID_GUARD_HEARTBEAT_INPUT.nextDeadmanCommand, "NEXT")
  assert.equal((outer.match(/cron\.alter_job/g) ?? []).length, 1)
  assert.match(outer, /cron\.alter_job\(job_id := 12, command := materialized_next\)/)
  const sampleTail = outer.slice(outer.indexOf("with heartbeat_clock as ("))
  assert.doesNotMatch(sampleTail, /cron\.(alter_job|schedule|unschedule)/)
  assert.doesNotMatch(sampleTail,
    /^\s*(update|insert|delete|create|drop|truncate|grant|revoke)\b/im)
  assert.doesNotMatch(sampleTail,
    /https?:|payload|credential|password|token|customer|payment|pg_net|net\./i)
  assert.doesNotMatch(sampleTail, /\bprod(?:uction)?\b/i)
})
