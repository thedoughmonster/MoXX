import assert from "node:assert/strict"
import { lstat, readFile, readdir, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { test } from "node:test"

import { appendReceipt } from "./append_receipt.ts"
import { createProgramHarness } from "./create_program_harness.test_fixture.ts"
import { initializeReceipt } from "./initialize_receipt.ts"
import { invalidateFinalArtifact } from "./invalidate_final_artifact.ts"
import { writeFinalArtifact } from "./write_final_artifact.ts"

test("failed prepublication liveness preserves private invalidated artifact", async () => {
  const harness = await createProgramHarness()
  try {
    const runId = `run-${"f".repeat(24)}`
    const receipt = await initializeReceipt(harness.source.input.receiptRoot, runId)
    const timestamp = new Date(harness.source.telemetry.nowUtcMs).toISOString()
    await appendReceipt(receipt, { event_type: "run_started", timestamp_utc: timestamp,
      metrics: { project_ref: "xtbraqnlskmqxinjxxdn", status: "started" } })
    await assert.rejects(writeFinalArtifact({
      runtime: harness.source.input.runtime, receipt, runId,
      status: "pre_guard_failure", reason: "cancelled",
      fastCount: null, resourceCount: null, guardResolution: "unknown",
      guardAbsent: null, targetJobs: null, finalFast: null, finalResource: null,
      deadmanEvidence: null, terminalAtUtc: timestamp,
    }, { beforePublish: () => { throw new Error("holder lost") } }))
    assert.deepEqual((await readdir(receipt.directory)).sort(),
      ["final.invalidated.json", "receipt.ndjson"])
    const info = await lstat(join(receipt.directory, "final.invalidated.json"))
    assert.equal(info.isFile(), true)
    assert.equal(info.isSymbolicLink(), false)
    assert.equal(info.nlink, 1)
    assert.equal(info.mode & 0o777, 0o600)
  } finally { await harness.source.cleanup() }
})

test("invalidation cannot overwrite a preexisting private artifact path", async () => {
  const harness = await createProgramHarness()
  try {
    const runId = `run-${"1".repeat(24)}`
    const receipt = await initializeReceipt(harness.source.input.receiptRoot, runId)
    const timestamp = new Date(harness.source.telemetry.nowUtcMs).toISOString()
    await appendReceipt(receipt, { event_type: "run_started", timestamp_utc: timestamp,
      metrics: { project_ref: "xtbraqnlskmqxinjxxdn", status: "started" } })
    const published = await writeFinalArtifact({
      runtime: harness.source.input.runtime, receipt, runId,
      status: "pre_guard_failure", reason: "cancelled",
      fastCount: null, resourceCount: null, guardResolution: "unknown",
      guardAbsent: null, targetJobs: null, finalFast: null, finalResource: null,
      deadmanEvidence: null, terminalAtUtc: timestamp,
    })
    const target = join(harness.source.input.receiptRoot, "invalidation-target")
    await writeFile(target, "preserve", { mode: 0o600 })
    await symlink(target, join(receipt.directory, "final.invalidated.json"))
    await assert.rejects(invalidateFinalArtifact(published))
    assert.equal(await readFile(target, "utf8"), "preserve")
    assert.equal(await readFile(published.path, "utf8") !== "preserve", true)
  } finally { await harness.source.cleanup() }
})
