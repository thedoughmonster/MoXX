import assert from "node:assert/strict"
import { lstat, readFile, readdir } from "node:fs/promises"
import { dirname } from "node:path"
import { test } from "node:test"

import { canonicalJson } from "./canonical_json.ts"
import { createRecoveryClassificationHarness } from "./create_recovery_classification_harness.test_fixture.ts"
import { runRecoveryClassificationProgram } from "./run_recovery_classification_program.ts"
import { sha256Text } from "./sha256_text.ts"

test("classification claims once, reads once, closes, and publishes one safe receipt", async () => {
  const harness = await createRecoveryClassificationHarness()
  try {
    const result = await runRecoveryClassificationProgram([
      "--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn",
    ], process.cwd(), harness.dependencies)
    assert.equal(result.exitCode, 0)
    assert.deepEqual(harness.telemetry, {
      prepared: 1, treeReads: 1, queried: 1, released: 1, closed: 1,
    })
    assert.equal(result.envelope?.status, "accepted_classification")
    const path = result.envelope!.finalReceiptPath
    const [text, file, directory, entries] = await Promise.all([
      readFile(path, "utf8"), lstat(path), lstat(dirname(path)), readdir(dirname(path)),
    ])
    assert.equal(file.mode & 0o777, 0o600)
    assert.equal(directory.mode & 0o777, 0o700)
    assert.deepEqual(entries.sort(), ["classification.json", "receipt.ndjson"])
    assert.equal(Buffer.byteLength(text), file.size)
    assert.ok(file.size < 32 * 1024)
    const receipt = JSON.parse(text)
    assert.equal(text, `${canonicalJson(receipt)}\n`)
    assert.equal(result.envelope?.finalReceiptSha256, sha256Text(text))
    assert.deepEqual(receipt.release, { sha: "a".repeat(40), tree_sha: "b".repeat(40) })
    assert.equal(receipt.setup_claim.disposition, "claimed_once")
    assert.match(receipt.setup_claim.receipt_sha256, /^[a-f0-9]{64}$/)
    assert.match(receipt.setup_claim.setup_query_identity_sha256, /^[a-f0-9]{64}$/)
    assert.equal(receipt.query.count, 1)
    assert.match(receipt.query.sha256, /^[a-f0-9]{64}$/)
    assert.equal(receipt.query.duration_ms,
      Date.parse(receipt.query.ended_at_utc) - Date.parse(receipt.query.started_at_utc))
    assert.equal(receipt.query.final_control_from_same_query, true)
    assert.deepEqual(receipt.invariant_groups.accepted, {
      work: true, control: true, cohort: true, routes: true, safety: true,
    })
    assert.deepEqual(receipt.invariant_groups.rejected, {
      work: false, control: false, cohort: false, routes: false, safety: false,
    })
    assert.equal(receipt.control_evidence.target_active_mask, 0)
    assert.equal(receipt.control_evidence.source_query_sha256, receipt.query.sha256)
    assert.equal(receipt.control_evidence.lifecycle_lock_held_during_publication, true)
    assert.equal(receipt.control_evidence.provider_closed_before_publication, true)
    assert.match(receipt.control_evidence.target_identity_sha256, /^[a-f0-9]{64}$/)
    assert.match(receipt.cohort_evidence.membership_sha256, /^[a-f0-9]{64}$/)
    assert.match(receipt.cohort_evidence.lineage_edge_sha256, /^[a-f0-9]{64}$/)
    assert.equal(receipt.receipt_chain.terminal_event, "run_completed")
    assert.equal(receipt.receipt_chain.terminal_sequence, 3)
    assert.match(receipt.receipt_chain.terminal_sha256, /^[a-f0-9]{64}$/)
    assert.deepEqual(receipt.effects, { provider_query_read_only: true,
      provider_mutation_possible: false, guard_created: false, targets_activated: false,
      cron_mutated: false, queue_or_durable_work_mutated: false,
      production_accessed: false, cleanup_performed: false })
    for (const forbidden of ["postgresql://", "supabase.com", "select ",
      "private provider", "cohort_membership_proof", "cohort_lineage_proof",
      "due_occurrences", "target_jobs", "payment", "customer", "Error:"])
      assert.equal(text.includes(forbidden), false)
  } finally { await harness.cleanup() }
})
