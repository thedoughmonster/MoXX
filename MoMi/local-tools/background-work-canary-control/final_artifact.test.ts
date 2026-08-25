import assert from "node:assert/strict"
import { chmod, link, lstat, readFile, symlink,
  writeFile } from "node:fs/promises"
import { join } from "node:path"
import { test } from "node:test"

import { createProgramHarness } from "./create_program_harness.test_fixture.ts"
import { appendReceipt } from "./append_receipt.ts"
import { initializeReceipt } from "./initialize_receipt.ts"
import { runCanaryControlProgram } from "./run_canary_control_program.ts"
import { sha256Text } from "./sha256_text.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"
import { writeFinalArtifact } from "./write_final_artifact.ts"

const argv = ["--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn"]

test("final artifact is canonical, bounded, private, and bound to the NDJSON tail", async () => {
  const harness = await createProgramHarness()
  try {
    const result = await runCanaryControlProgram(
      argv, harness.repositoryRoot, harness.dependencies,
    )
    assert.equal(result.exitCode, 0)
    assert.ok(result.envelope)
    const bytes = await readFile(result.envelope.finalReceiptPath, "utf8")
    const artifact = JSON.parse(bytes)
    const info = await lstat(result.envelope.finalReceiptPath)
    assert.equal(info.isFile(), true)
    assert.equal(info.isSymbolicLink(), false)
    assert.equal(info.nlink, 1)
    assert.equal(info.mode & 0o777, 0o600)
    assert.equal(sha256Text(bytes), result.envelope.finalReceiptSha256)
    assert.deepEqual(Object.keys(artifact).sort(), [
      "cumulativeEvidence", "deadmanEvidence", "guard", "projectRef", "receipt", "releasedHeadSha",
      "resourceEvidence", "runId", "sampling", "schemaVersion", "targetsInactive",
      "terminal", "timestamps",
    ])
    assert.deepEqual(artifact.sampling, { fastCount: 21, resourceCount: 6 })
    assert.deepEqual(artifact.guard, { absent: true, resolution: "cleaned" })
    assert.equal(artifact.schemaVersion, 2)
    assert.equal(artifact.cumulativeEvidence.guardRunCount, 1)
    assert.equal(artifact.deadmanEvidence.guardStatus, "succeeded")
    assert.deepEqual(artifact.targetsInactive, {
      eventRouting: true, toastAcquisition: true,
      warehouseProjectionDatabase: true, warehouseProjectionWakeup: true,
    })
    const receiptPath = result.envelope.finalReceiptPath.replace(/final\.json$/, "receipt.ndjson")
    assert.equal(artifact.receipt.terminalHash,
      (await verifyReceiptFile(receiptPath)).lastHash)
    const records = (await readFile(receiptPath, "utf8")).trim().split("\n").map(JSON.parse)
    const reconciliation = records.find((record) =>
      record.event_type === "deadman_reconciled")
    assert.equal(reconciliation.metrics.guard.terminal_guard_run_id,
      artifact.deadmanEvidence.guardRunId)
    assert.equal(reconciliation.metrics.guard.exact_identity_mask, 15)
    assert.equal(reconciliation.metrics.guard.active_before_mask, 0)
    assert.equal(reconciliation.metrics.guard.inactive_after_mask, 15)
  } finally {
    await harness.source.cleanup()
  }
})

test("a final artifact failure cannot emit success or release the lifecycle lock", async () => {
  const harness = await createProgramHarness({ failFinalArtifact: true })
  try {
    const result = await runCanaryControlProgram(
      argv, harness.repositoryRoot, harness.dependencies,
    )
    assert.deepEqual(result, {
      exitCode: 40, stderrCode: "MANUAL_RECONCILIATION_REQUIRED", envelope: null,
    })
    assert.equal(harness.source.telemetry.releases, 0)
    const [runDirectory] = await import("node:fs/promises").then(({ readdir }) =>
      readdir(harness.source.input.receiptRoot))
    const receipt = await readFile(
      `${harness.source.input.receiptRoot}/${runDirectory}/receipt.ndjson`, "utf8",
    )
    const last = JSON.parse(receipt.trim().split("\n").at(-1)!)
    assert.equal(last.event_type, "failure")
    assert.equal(last.metrics.error_class, "final_artifact_failed")
  } finally {
    await harness.source.cleanup()
  }
})

test("preexisting symlink and hardlink final paths are never replaced", async () => {
  const harness = await createProgramHarness()
  try {
    for (const [suffix, kind] of [["a", "symlink"], ["b", "hardlink"]] as const) {
      const runId = `run-${suffix.repeat(24)}`
      const receipt = await initializeReceipt(harness.source.input.receiptRoot, runId)
      const timestamp = new Date(harness.source.telemetry.nowUtcMs).toISOString()
      await appendReceipt(receipt, {
        event_type: "run_started", timestamp_utc: timestamp,
        metrics: { project_ref: "xtbraqnlskmqxinjxxdn", status: "started" },
      })
      const target = join(harness.source.input.receiptRoot, `${kind}-target`)
      await writeFile(target, "preserve", { mode: 0o600 })
      await chmod(target, 0o600)
      const finalPath = join(receipt.directory, "final.json")
      if (kind === "symlink") await symlink(target, finalPath)
      else await link(target, finalPath)
      await assert.rejects(writeFinalArtifact({
        runtime: harness.source.input.runtime, receipt, runId,
        status: "pre_guard_failure", reason: "cancelled",
        fastCount: null, resourceCount: null,
        guardResolution: "unknown", guardAbsent: null,
        targetJobs: null, finalFast: null, finalResource: null,
        deadmanEvidence: null,
        terminalAtUtc: timestamp,
      }))
      assert.equal(await readFile(target, "utf8"), "preserve")
    }
  } finally {
    await harness.source.cleanup()
  }
})
