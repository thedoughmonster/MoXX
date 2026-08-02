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
  assert.equal(Buffer.byteLength(fast), 22_165)
  assert.equal(createHash("sha256").update(fast).digest("hex"),
    "2f17adb9a10a929360adf3533e98b0da58610314bc132f4b5800c3b82549fa11")
  assert.equal(Buffer.byteLength(resource), 24_830)
  assert.equal(createHash("sha256").update(resource).digest("hex"),
    "f5f2f8431984bd4594dce2d822dff2917d398890dc032463cdca194b76551614")
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
    /substring\(j\.command from 'timestamptz ''\(\[\^''\]\+\)'''\)::timestamptz\n    - interval '30 seconds' as observed_at/)
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
