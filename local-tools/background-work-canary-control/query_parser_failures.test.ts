import assert from "node:assert/strict"
import { test } from "node:test"
import { parseFastQueryOutput } from "./parse_fast_query_output.ts"
import { parseResourceQueryOutput } from "./parse_resource_query_output.ts"
import {
  VALID_FAST_QUERY_SAMPLE,
  VALID_RESOURCE_BASELINE,
  VALID_RESOURCE_QUERY_SAMPLE,
  VALID_START_CRON_RUN_ID,
} from "./query_sample_fixtures.test_fixture.ts"
import { FAST_SQL_MARKER, RESOURCE_SQL_MARKER } from "./sql_artifact_constants.ts"

const context = {
  expectedGuardPresent: true, startCronRunId: VALID_START_CRON_RUN_ID,
  missedSamples: 0, overlappingSamples: 0,
}
const bytes = (value: unknown) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")

test("fast parser rejects noise, raw output, multiple rows, and envelope drift", () => {
  const row = { marker: FAST_SQL_MARKER, schema_version: 1, sample: VALID_FAST_QUERY_SAMPLE }
  assert.throws(() => parseFastQueryOutput(Buffer.from("notice\n[]\n"), context))
  assert.throws(() => parseFastQueryOutput(Buffer.from("[]"), context))
  assert.throws(() => parseFastQueryOutput(bytes({ rows: [row] }), context))
  assert.throws(() => parseFastQueryOutput(bytes([row, row]), context))
  assert.throws(() => parseFastQueryOutput(bytes([{ ...row, extra: true }]), context))
  assert.throws(() => parseFastQueryOutput(bytes([{ ...row, schema_version: 2 }]), context))
  assert.throws(() => parseFastQueryOutput(bytes([{ ...row, marker: RESOURCE_SQL_MARKER }]), context))
  assert.throws(() => parseFastQueryOutput(Buffer.from("[{bad}]\n"), context))
})

test("fast parser rejects missing or extra fields and guard-state mismatch", () => {
  const missing = { ...VALID_FAST_QUERY_SAMPLE }
  delete missing.toastReady
  const extra = { ...VALID_FAST_QUERY_SAMPLE, unexpected: 1 }
  const row = (sample: unknown) => bytes([{
    marker: FAST_SQL_MARKER, schema_version: 1, sample,
  }])
  assert.throws(() => parseFastQueryOutput(row(missing), context))
  assert.throws(() => parseFastQueryOutput(row(extra), context))
  assert.throws(() => parseFastQueryOutput(row(VALID_FAST_QUERY_SAMPLE), {
    ...context, expectedGuardPresent: false,
  }))
  assert.throws(() => parseFastQueryOutput(row({
    ...VALID_FAST_QUERY_SAMPLE, maximumTargetFailureRunId: -1,
  }), context))
})

test("resource parser rejects raw schema drift and malformed baselines", () => {
  const output = bytes([{
    marker: RESOURCE_SQL_MARKER, schema_version: 1, sample: VALID_RESOURCE_QUERY_SAMPLE,
  }])
  assert.throws(() => parseResourceQueryOutput(output, {
    ...VALID_RESOURCE_BASELINE, databaseBytes: 9_000_000,
  }))
  assert.throws(() => parseResourceQueryOutput(output, {
    ...VALID_RESOURCE_BASELINE, extra: 1,
  }))
  assert.throws(() => parseResourceQueryOutput(bytes([{
    marker: RESOURCE_SQL_MARKER, schema_version: 1,
    sample: { ...VALID_RESOURCE_QUERY_SAMPLE, rawSql: "select" },
  }]), VALID_RESOURCE_BASELINE))
})
