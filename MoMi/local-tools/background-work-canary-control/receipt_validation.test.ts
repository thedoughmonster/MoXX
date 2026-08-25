import assert from "node:assert/strict"
import test from "node:test"

import { validateReceiptInput } from "./validate_receipt_input.ts"
import { validateRunId } from "./validate_run_id.ts"

test("receipt schema rejects unsafe identities, keys, and values", () => {
  assert.doesNotThrow(validateRunId.bind(null, "run-20260802-abcdef"))
  for (const runId of ["", "short", "../escape", "/absolute", "UPPERCASE-ID"]) {
    assert.throws(validateRunId.bind(null, runId), /Run ID/)
  }
  assert.throws(validateRunId.bind(null, `run-${"a".repeat(70)}`), /Run ID/)

  const base = {
    event_type: "failure",
    timestamp_utc: "2026-08-02T00:00:00.000Z",
    metrics: { error_class: "parser_failure", status: "failed" },
  }
  assert.doesNotThrow(validateReceiptInput.bind(null, base))
  assert.throws(validateReceiptInput.bind(null, { ...base, raw_sql: "select 1" }), /unsupported/i)
  assert.throws(validateReceiptInput.bind(null, {
    ...base,
    metrics: { raw_sql: "select 1" },
  }), /Unsupported receipt metric/)
  assert.throws(validateReceiptInput.bind(null, {
    ...base,
    metrics: { url: "https://provider.invalid" },
  }), /Unsupported receipt metric/)
  assert.throws(validateReceiptInput.bind(null, {
    ...base,
    metrics: { environment: { SUPABASE_ACCESS_TOKEN: "redacted" } },
  }), /Unsupported receipt metric/)
  assert.throws(validateReceiptInput.bind(null, {
    ...base,
    metrics: { target: { payload: "redacted" } },
  }), /Unsupported receipt metric/)
  assert.throws(validateReceiptInput.bind(null, {
    ...base,
    metrics: { error_class: "https://provider.invalid" },
  }), /error_class/)
  assert.doesNotThrow(validateReceiptInput.bind(null, {
    ...base,
    metrics: { ...base.metrics, child_exit_code: 1,
      provider_code: "momi_guard_heartbeat_current_command",
      parse_subreason: "expiry",
      observed_top_level_type: "array", observed_row_count: 1,
      observed_outer_keys: "marker,sample,schema_version",
      observed_outer_unexpected_keys: 0,
      observed_sample_keys: "expiryUtc,guardJobId",
      observed_sample_unexpected_keys: 0,
      observed_value_types: "expiryUtc:string,guardJobId:number" },
  }))
  assert.throws(validateReceiptInput.bind(null, {
    ...base, metrics: { ...base.metrics, parse_subreason: "raw_provider_error" },
  }), /parse_subreason/)
  for (const child_exit_code of [0, 256]) assert.throws(validateReceiptInput.bind(null, {
    ...base, metrics: { ...base.metrics, child_exit_code },
  }), /child_exit_code/)
  assert.throws(validateReceiptInput.bind(null, {
    ...base, metrics: { ...base.metrics, provider_code: "raw_provider_error" },
  }), /provider_code/)
  assert.throws(validateReceiptInput.bind(null, {
    ...base, metrics: { ...base.metrics, observed_sample_keys: "token=https" },
  }), /observed_sample_keys/)
  assert.throws(validateReceiptInput.bind(null, {
    ...base,
    metrics: { duration_ms: Number.NaN },
  }), /safe integer/)
  assert.throws(validateReceiptInput.bind(null, {
    ...base,
    metrics: { duration_ms: -1 },
  }), /safe integer/)
  assert.throws(validateReceiptInput.bind(null, {
    ...base,
    metrics: { timing: { duration_ms: { nested: 1 } } },
  }), /safe integer/)
  assert.throws(validateReceiptInput.bind(null, {
    ...base,
    timestamp_utc: "2026-08-02T00:00:00+00:00",
  }), /canonical UTC/)
})
