import assert from "node:assert/strict"
import { test } from "node:test"
import {
  VALID_GUARD_BOOTSTRAP_INPUT,
  VALID_GUARD_BOOTSTRAP_RESULT,
} from "./guard_bootstrap.test_fixture.ts"
import { parseGuardBootstrapOutput } from "./parse_guard_bootstrap_output.ts"

const context = {
  runId: VALID_GUARD_BOOTSTRAP_INPUT.runId,
  generationSha256: VALID_GUARD_BOOTSTRAP_INPUT.generationSha256,
  startCronRunId: VALID_GUARD_BOOTSTRAP_INPUT.startCronRunId,
}

function encode(row: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify([{
    marker: "momi.background-work-canary.guard-bootstrap",
    schema_version: 1,
    sample: row,
  }])}\n`)
}

test("parser accepts one exact sanitized bootstrap result", () => {
  assert.deepEqual(
    parseGuardBootstrapOutput(encode(VALID_GUARD_BOOTSTRAP_RESULT), context),
    VALID_GUARD_BOOTSTRAP_RESULT,
  )
})

test("parser rejects identity, generation, expiry, hash, and ID drift", () => {
  const changes = [
    { guardJobId: 0 },
    { guardName: "other" },
    { guardSchedule: "10 seconds" },
    { guardActive: false },
    { runId: "run-other" },
    { generationSha256: "d".repeat(64) },
    { expiryUtc: "2026-08-02T02:03:04Z" },
    { expiryUtc: "2026-02-30T02:03:04.123456Z" },
    { commandSha256: "A".repeat(64) },
    { commandMd5: "x".repeat(32) },
  ]
  for (const change of changes) {
    assert.throws(() => parseGuardBootstrapOutput(
      encode({ ...VALID_GUARD_BOOTSTRAP_RESULT, ...change }), context,
    ))
  }
})

test("bootstrap hashes are bound to canonical generation and expiry bytes", () => {
  for (const change of [
    { commandSha256: "0".repeat(64) },
    { commandMd5: "0".repeat(32) },
    { expiryUtc: "2026-08-02T02:03:05.123456Z" },
  ]) assert.throws(() => parseGuardBootstrapOutput(
    encode({ ...VALID_GUARD_BOOTSTRAP_RESULT, ...change }), context,
  ))
  const generationSha256 = "0".repeat(64)
  assert.throws(() => parseGuardBootstrapOutput(encode({
    ...VALID_GUARD_BOOTSTRAP_RESULT, generationSha256,
  }), { ...context, generationSha256 }))
})

test("parser never accepts command text, extra fields, rows, or envelope drift", () => {
  assert.throws(() => parseGuardBootstrapOutput(encode({
    ...VALID_GUARD_BOOTSTRAP_RESULT,
    command: "secret command body",
  }), context))
  assert.throws(() => parseGuardBootstrapOutput(
    encode(VALID_GUARD_BOOTSTRAP_RESULT), { ...context, extra: true },
  ))
  const wrongMarker = new TextEncoder().encode(`${JSON.stringify([{
    marker: "other", schema_version: 1, sample: VALID_GUARD_BOOTSTRAP_RESULT,
  }])}\n`)
  assert.throws(() => parseGuardBootstrapOutput(wrongMarker, context))
  const wrongVersion = new TextEncoder().encode(`${JSON.stringify([{
    marker: "momi.background-work-canary.guard-bootstrap", schema_version: 2,
    sample: VALID_GUARD_BOOTSTRAP_RESULT,
  }])}\n`)
  assert.throws(() => parseGuardBootstrapOutput(wrongVersion, context))
  const rows = new TextEncoder().encode(`${JSON.stringify([
    { marker: "momi.background-work-canary.guard-bootstrap", schema_version: 1,
      sample: VALID_GUARD_BOOTSTRAP_RESULT },
    { marker: "momi.background-work-canary.guard-bootstrap", schema_version: 1,
      sample: VALID_GUARD_BOOTSTRAP_RESULT },
  ])}\n`)
  assert.throws(() => parseGuardBootstrapOutput(rows, context))
})
