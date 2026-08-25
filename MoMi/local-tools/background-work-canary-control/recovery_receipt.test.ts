import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { appendReceipt } from "./append_receipt.ts"
import { buildReceiptRecord } from "./build_receipt_record.ts"
import { createRecoverySnapshotFixture } from "./create_recovery_snapshot.test_fixture.ts"
import { initializeReceipt } from "./initialize_receipt.ts"
import { RECEIPT_GENESIS } from "./receipt_constants.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"
import { writeRecoveryArtifact } from "./write_recovery_artifact.ts"

test("recovery receipt events remain hash chained and sanitized", () => {
  const first = buildReceiptRecord({ event_type: "activation_completed",
    timestamp_utc: "2026-08-03T10:20:00.000Z", metrics: {
      status: "active", registry_count: 49, registry_sha256: "a".repeat(64),
      routing_catalog_count: 2, routing_catalog_sha256: "c".repeat(64),
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

test("permanent recovery receipt proves immutable membership without row identities", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-recovery-receipt-"))
  try {
    const receipt = await initializeReceipt(root, "run-0123456789abcdef01234567")
    await appendReceipt(receipt, { event_type: "run_started",
      timestamp_utc: "2026-08-03T10:20:00.000Z",
      metrics: { status: "started", project_ref: "xtbraqnlskmqxinjxxdn" } })
    const frozen = createRecoverySnapshotFixture({ dueOccurrences: [
      { scheduleKey: "toast.private:restaurant-identity:daily", dueAtUtcMs: 1_785_751_900_000 },
    ] })
    const final = createRecoverySnapshotFixture({ targetJobs:
      frozen.targetJobs.map((job) => ({ ...job, active: false })) })
    const state = { receipt, runId: "run-0123456789abcdef01234567",
      runtime: { options: { projectRef: "xtbraqnlskmqxinjxxdn" },
        repository: { headSha: "a".repeat(40) } }, activation: {
        startedAtUtcMs: frozen.cohortStartedAtUtcMs, frozen },
      fastSamples: 2, resourceSamples: 1, zeroSamples: 2,
      recoveryPath: "explicit_rollback" } as never
    const artifact = await writeRecoveryArtifact(state, "passed", final,
      await verifyReceiptFile(receipt.path), final.observedAtUtcMs)
    const text = await readFile(artifact.path, "utf8")
    const parsed = JSON.parse(text)
    assert.equal(parsed.schema_version, 2)
    assert.equal(parsed.immutable_cohort.boundary_sha256, frozen.cohortBoundarySha256)
    assert.equal(parsed.immutable_cohort.due_occurrence_count, 1)
    assert.equal(text.includes("toast.private:restaurant-identity:daily"), false)
    assert.equal("due_occurrences" in parsed.immutable_cohort, false)
  } finally { await rm(root, { recursive: true, force: true }) }
})
