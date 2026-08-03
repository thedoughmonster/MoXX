import assert from "node:assert/strict"
import test from "node:test"

import { buildReceiptRecord } from "./build_receipt_record.ts"
import { RECEIPT_GENESIS } from "./receipt_constants.ts"

test("recovery receipt events remain hash chained and sanitized", () => {
  const first = buildReceiptRecord({ event_type: "activation_completed",
    timestamp_utc: "2026-08-03T10:20:00.000Z", metrics: {
      status: "active", registry_count: 49, registry_sha256: "a".repeat(64),
      toast_sha256: "b".repeat(64) } }, 1, RECEIPT_GENESIS)
  const second = buildReceiptRecord({ event_type: "canary_observation",
    timestamp_utc: "2026-08-03T10:20:15.000Z", metrics: {
      status: "passed", completed_count: 1, zero_samples: 0 } },
  2, first.current_hash)
  assert.equal(second.previous_hash, first.current_hash)
  assert.match(second.current_hash, /^[a-f0-9]{64}$/)
  assert.throws(() => buildReceiptRecord({ event_type: "canary_observation",
    timestamp_utc: "2026-08-03T10:20:15.000Z",
    metrics: { status: "passed", sql: "select secret" } } as never,
  2, first.current_hash))
})
