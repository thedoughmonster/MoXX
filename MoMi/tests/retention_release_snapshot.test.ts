import assert from "node:assert/strict"
import test from "node:test"
import { assertRetentionSnapshot } from "../scripts/release/retention/assert_snapshot.ts"
import type { RetentionApproval } from "../scripts/release/retention/types.ts"

test("binds the before snapshot and deferred scope while retaining unknown hosted history", () => {
  const existing = "20000101000000", unknown = "20000201000000"
  const deferred = "20000301000000", selected = "20000401000000"
  const snapshot = { ledger: [
    { version: existing, sha256: "1".repeat(64) },
    { version: unknown, sha256: "2".repeat(64) },
  ], ledger_sha256: "3".repeat(64), objects_sha256: "4".repeat(64) }
  const approval: RetentionApproval = {
    schema_version: 1, kind: "retention-release-exception", environment: "dev",
    project_ref: "synthetic-project", source_sha: "a".repeat(40),
    issued_at: "2026-09-01T00:00:00Z", expires_at: "2026-09-02T00:00:00Z",
    validation: { run_id: 1, head_sha: "a".repeat(40), receipt_sha256: "5".repeat(64) },
    before: { ledger_sha256: snapshot.ledger_sha256, objects_sha256: snapshot.objects_sha256,
      functions_sha256: "6".repeat(64), versions: [existing, unknown] },
    function_source_sha256: "7".repeat(64), migrations: [selected],
    deferred_versions: [deferred], dev_receipt: null,
  }
  const local = [existing, deferred, selected]
  assert.doesNotThrow(() => assertRetentionSnapshot(approval, snapshot, local))
  assert.doesNotThrow(() => assertRetentionSnapshot(approval, snapshot, [...local].reverse()))
  for (const changed of [
    { ...snapshot, ledger_sha256: "8".repeat(64) },
    { ...snapshot, objects_sha256: "9".repeat(64) },
    { ...snapshot, ledger: [snapshot.ledger[0]] },
    { ...snapshot, ledger: [...snapshot.ledger].reverse() },
    { ...snapshot, ledger: [...snapshot.ledger, { version: "20000501000000", sha256: "0".repeat(64) }] },
  ]) assert.throws(() => assertRetentionSnapshot(approval, changed, local), /before-state or deferred inventory/)
  for (const changed of [
    [...local, "20000601000000"], [existing, selected],
    [existing, "20000701000000", selected],
  ]) assert.throws(() => assertRetentionSnapshot(approval, snapshot, changed), /before-state or deferred inventory/)
  assert.throws(() => assertRetentionSnapshot({ ...approval, deferred_versions: [] }, snapshot, local))
  const alreadyApplied = { ...snapshot,
    ledger: [...snapshot.ledger, { version: selected, sha256: "0".repeat(64) }] }
  assert.throws(() => assertRetentionSnapshot({ ...approval,
    before: { ...approval.before, versions: [existing, unknown, selected] },
  }, alreadyApplied, local), /before-state or deferred inventory/)
})
