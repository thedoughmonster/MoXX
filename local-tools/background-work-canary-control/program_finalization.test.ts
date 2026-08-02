import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { test } from "node:test"

import { createProgramHarness } from "./create_program_harness.test_fixture.ts"
import { runCanaryControlProgram } from "./run_canary_control_program.ts"
import { sha256Text } from "./sha256_text.ts"

const argv = ["--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn"]

test("holder loss inside real final writer cannot publish or emit success", async () => {
  const harness = await createProgramHarness({ lockLossAt: "before_final_publish" })
  try {
    const result = await runCanaryControlProgram(
      argv, harness.repositoryRoot, harness.dependencies,
    )
    assert.deepEqual(result, {
      exitCode: 40, stderrCode: "MANUAL_RECONCILIATION_REQUIRED", envelope: null,
    })
    assert.equal(harness.source.input.runtime.lock.status(), "lost")
    assert.equal(harness.source.telemetry.releases, 0)
    const [runDirectory] = await readdir(harness.source.input.receiptRoot)
    const directory = join(harness.source.input.receiptRoot, runDirectory)
    assert.deepEqual((await readdir(directory)).sort(),
      ["final.invalidated.json", "receipt.ndjson"])
    const receipt = (await readFile(join(directory, "receipt.ndjson"), "utf8"))
      .trim().split("\n").map(JSON.parse)
    assert.equal(receipt.at(-1).metrics.error_class, "finalization_lock_lost")
  } finally { await harness.source.cleanup() }
})

test("loss before release replaces success with authoritative manual artifact", async () => {
  const harness = await createProgramHarness({ lockLossAt: "before_release" })
  try {
    const result = await runCanaryControlProgram(
      argv, harness.repositoryRoot, harness.dependencies,
    )
    assert.equal(result.exitCode, 40)
    assert.equal(result.envelope?.status, "manual_reconciliation_required")
    assert.equal(harness.source.input.runtime.lock.status(), "lost")
    const finalPath = result.envelope!.finalReceiptPath
    const directory = join(finalPath, "..")
    assert.deepEqual((await readdir(directory)).sort(),
      ["final.invalidated.json", "final.json", "receipt.ndjson"])
    const authoritative = JSON.parse(await readFile(finalPath, "utf8"))
    const invalidatedBytes = await readFile(join(directory, "final.invalidated.json"), "utf8")
    const invalidated = JSON.parse(invalidatedBytes)
    assert.equal(authoritative.terminal.status, "manual_reconciliation_required")
    assert.equal(authoritative.terminal.reason, "lifecycle_lock_lost")
    assert.equal(invalidated.terminal.status, "inactive_dry_run_verified")
    assert.notEqual(result.envelope?.finalReceiptSha256, sha256Text(invalidatedBytes))
    const receipt = (await readFile(join(directory, "receipt.ndjson"), "utf8"))
      .trim().split("\n").map(JSON.parse)
    assert.equal(receipt.at(-1).metrics.error_class, "finalization_lock_lost")
  } finally { await harness.source.cleanup() }
})

test("replacement artifact failure preserves invalidated success and emits no envelope", async () => {
  const harness = await createProgramHarness({
    lockLossAt: "before_release", finalizationFailure: "artifact",
  })
  try {
    const result = await runCanaryControlProgram(
      argv, harness.repositoryRoot, harness.dependencies,
    )
    assert.equal(result.exitCode, 40)
    assert.equal(result.envelope, null)
    const [runDirectory] = await readdir(harness.source.input.receiptRoot)
    const entries = await readdir(join(harness.source.input.receiptRoot, runDirectory))
    assert.deepEqual(entries.sort(), ["final.invalidated.json", "receipt.ndjson"])
  } finally { await harness.source.cleanup() }
})

test("lock-loss receipt failure preserves invalidated success and emits no envelope", async () => {
  const harness = await createProgramHarness({
    lockLossAt: "before_release", finalizationFailure: "receipt",
  })
  try {
    const result = await runCanaryControlProgram(
      argv, harness.repositoryRoot, harness.dependencies,
    )
    assert.equal(result.exitCode, 40)
    assert.equal(result.envelope, null)
    assert.equal(harness.source.input.runtime.lock.status(), "lost")
    const [runDirectory] = await readdir(harness.source.input.receiptRoot)
    const entries = await readdir(join(harness.source.input.receiptRoot, runDirectory))
    assert.deepEqual(entries.sort(), ["final.invalidated.json", "receipt.ndjson"])
  } finally { await harness.source.cleanup() }
})
