import assert from "node:assert/strict"
import { link, lstat, readFile, readdir, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { test } from "node:test"

import { appendReceipt } from "./append_receipt.ts"
import { createProgramHarness } from "./create_program_harness.test_fixture.ts"
import { initializeReceipt } from "./initialize_receipt.ts"
import { invalidateFinalArtifact } from "./invalidate_final_artifact.ts"
import { publishStagedFinalArtifact } from "./publish_staged_final_artifact.ts"
import { stageFinalArtifact } from "./stage_final_artifact.ts"

test("prospective artifact is private through publication and invalidation", async () => {
  const harness = await createProgramHarness()
  try {
    const runId = `run-${"c".repeat(24)}`
    const receipt = await initializeReceipt(harness.source.input.receiptRoot, runId)
    const timestamp = new Date(harness.source.telemetry.nowUtcMs).toISOString()
    await appendReceipt(receipt, { event_type: "run_started", timestamp_utc: timestamp,
      metrics: { project_ref: "xtbraqnlskmqxinjxxdn", status: "started" } })
    const staged = await stageFinalArtifact({
      runtime: harness.source.input.runtime, receipt, runId,
      status: "pre_guard_failure", reason: "cancelled",
      fastCount: null, resourceCount: null, guardResolution: "unknown",
      guardAbsent: null, targetJobs: null, finalFast: null, finalResource: null,
      deadmanEvidence: null, terminalAtUtc: timestamp,
    })
    assert.deepEqual((await readdir(receipt.directory)).sort(),
      ["final.staging.json", "receipt.ndjson"])
    assert.equal((await lstat(staged.path)).mode & 0o777, 0o600)
    assert.equal((await lstat(staged.path)).nlink, 1)
    const published = await publishStagedFinalArtifact(staged)
    assert.deepEqual((await readdir(receipt.directory)).sort(),
      ["final.json", "receipt.ndjson"])
    const invalidated = await invalidateFinalArtifact(published)
    assert.deepEqual((await readdir(receipt.directory)).sort(),
      ["final.invalidated.json", "receipt.ndjson"])
    assert.equal((await lstat(invalidated.path)).mode & 0o777, 0o600)
    assert.equal((await lstat(invalidated.path)).nlink, 1)
    assert.equal(await readFile(invalidated.path, "utf8"), staged.bytes)
  } finally { await harness.source.cleanup() }
})

test("staging never replaces existing symlink or hardlink entries", async () => {
  const harness = await createProgramHarness()
  try {
    for (const [suffix, kind] of [["d", "symlink"], ["e", "hardlink"]] as const) {
      const runId = `run-${suffix.repeat(24)}`
      const receipt = await initializeReceipt(harness.source.input.receiptRoot, runId)
      const timestamp = new Date(harness.source.telemetry.nowUtcMs).toISOString()
      await appendReceipt(receipt, { event_type: "run_started", timestamp_utc: timestamp,
        metrics: { project_ref: "xtbraqnlskmqxinjxxdn", status: "started" } })
      const target = join(harness.source.input.receiptRoot, `${kind}-staging-target`)
      await writeFile(target, "preserve", { mode: 0o600 })
      const staging = join(receipt.directory, "final.staging.json")
      if (kind === "symlink") await symlink(target, staging)
      else await link(target, staging)
      await assert.rejects(stageFinalArtifact({
        runtime: harness.source.input.runtime, receipt, runId,
        status: "pre_guard_failure", reason: "cancelled",
        fastCount: null, resourceCount: null, guardResolution: "unknown",
        guardAbsent: null, targetJobs: null, finalFast: null, finalResource: null,
        deadmanEvidence: null, terminalAtUtc: timestamp,
      }))
      assert.equal(await readFile(target, "utf8"), "preserve")
    }
  } finally { await harness.source.cleanup() }
})
