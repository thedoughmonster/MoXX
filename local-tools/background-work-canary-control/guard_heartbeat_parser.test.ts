import assert from "node:assert/strict"
import { test } from "node:test"
import {
  VALID_GUARD_HEARTBEAT_INPUT,
  VALID_GUARD_HEARTBEAT_RESULT,
} from "./guard_heartbeat.test_fixture.ts"
import { parseGuardHeartbeatOutput } from "./parse_guard_heartbeat_output.ts"

const context = {
  runId: VALID_GUARD_HEARTBEAT_INPUT.runId,
  guardJobId: VALID_GUARD_HEARTBEAT_INPUT.guardJobId,
  previousGenerationSha256: VALID_GUARD_HEARTBEAT_INPUT.currentGenerationSha256,
  nextGenerationSha256: VALID_GUARD_HEARTBEAT_INPUT.nextGenerationSha256,
  startCronRunId: VALID_GUARD_HEARTBEAT_INPUT.startCronRunId,
}

function encode(row: unknown, marker = "momi.background-work-canary.guard-heartbeat",
  schemaVersion = 1): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify([{
    marker, schema_version: schemaVersion, sample: row,
  }])}\n`)
}

test("heartbeat parser accepts exact previous-to-next sanitized evidence", () => {
  assert.deepEqual(parseGuardHeartbeatOutput(
    encode(VALID_GUARD_HEARTBEAT_RESULT), context,
  ), VALID_GUARD_HEARTBEAT_RESULT)
})

test("heartbeat parser rejects identity, generation, expiry, hash, and ID drift", () => {
  const changes = [
    { guardJobId: 0 }, { guardJobId: 13 }, { guardName: "other" },
    { guardSchedule: "10 seconds" },
    { guardActive: false }, { runId: "run-other" },
    { previousGenerationSha256: "0".repeat(64) },
    { nextGenerationSha256: VALID_GUARD_HEARTBEAT_INPUT.currentGenerationSha256 },
    { expiryUtc: "2026-08-02T02:04:05Z" },
    { expiryUtc: "2026-02-30T02:04:05.654321Z" },
    { commandSha256: "A".repeat(64) }, { commandMd5: "x".repeat(32) },
  ]
  for (const change of changes) assert.throws(() => parseGuardHeartbeatOutput(
    encode({ ...VALID_GUARD_HEARTBEAT_RESULT, ...change }), context,
  ))
})

test("heartbeat hashes are bound to canonical next-generation and expiry bytes", () => {
  for (const change of [
    { commandSha256: "0".repeat(64) },
    { commandMd5: "0".repeat(32) },
    { expiryUtc: "2026-08-02T02:04:06.654321Z" },
  ]) assert.throws(() => parseGuardHeartbeatOutput(
    encode({ ...VALID_GUARD_HEARTBEAT_RESULT, ...change }), context,
  ))
  const nextGenerationSha256 = "0".repeat(64)
  assert.throws(() => parseGuardHeartbeatOutput(encode({
    ...VALID_GUARD_HEARTBEAT_RESULT, nextGenerationSha256,
  }), { ...context, nextGenerationSha256 }))
})

test("heartbeat parser rejects command text, context drift, noise, and envelope drift", () => {
  assert.throws(() => parseGuardHeartbeatOutput(encode({
    ...VALID_GUARD_HEARTBEAT_RESULT, command: "raw command",
  }), context))
  assert.throws(() => parseGuardHeartbeatOutput(
    encode(VALID_GUARD_HEARTBEAT_RESULT), { ...context, extra: true },
  ))
  assert.throws(() => parseGuardHeartbeatOutput(
    encode(VALID_GUARD_HEARTBEAT_RESULT), {
      ...context, nextGenerationSha256: context.previousGenerationSha256,
    },
  ))
  assert.throws(() => parseGuardHeartbeatOutput(
    encode(VALID_GUARD_HEARTBEAT_RESULT, "other"), context,
  ))
  assert.throws(() => parseGuardHeartbeatOutput(
    encode(VALID_GUARD_HEARTBEAT_RESULT, undefined, 2), context,
  ))
  const noisy = new TextEncoder().encode(`notice\n${new TextDecoder().decode(
    encode(VALID_GUARD_HEARTBEAT_RESULT),
  )}`)
  assert.throws(() => parseGuardHeartbeatOutput(noisy, context))
})
