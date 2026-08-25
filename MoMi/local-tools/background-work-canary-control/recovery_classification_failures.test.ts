import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { test } from "node:test"

import { createRecoveryClassificationHarness } from "./create_recovery_classification_harness.test_fixture.ts"
import { runRecoveryClassificationProgram } from "./run_recovery_classification_program.ts"

test("cancellation fails closed after one read and closes every control", async () => {
  const harness = await createRecoveryClassificationHarness()
  try {
    harness.abort()
    const result = await runRecoveryClassificationProgram([
      "--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn",
    ], process.cwd(), harness.dependencies)
    assert.equal(result.exitCode, 20)
    assert.equal(result.stderrCode, "PRE_GUARD_FAILURE")
    assert.deepEqual(harness.telemetry, {
      prepared: 1, treeReads: 1, queried: 1, released: 1, closed: 1,
    })
    const directory = (await readdir(harness.receiptRoot))[0]
    const artifact = await readFile(`${harness.receiptRoot}/${directory}/preflight-failure.json`,
      "utf8")
    assert.equal(JSON.parse(artifact).reason_category, "cancelled")
  } finally { await harness.cleanup() }
})

test("cancellation after the read cannot publish success or touch mutation paths", async () => {
  const harness = await createRecoveryClassificationHarness()
  try {
    const provider = harness.runtime.provider
    harness.runtime.provider = Object.freeze({
      runQuery: async (request) => {
        const result = await provider.runQuery(request)
        harness.abort()
        return result
      },
      status: provider.status, close: provider.close,
    })
    const result = await runRecoveryClassificationProgram([
      "--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn",
    ], process.cwd(), harness.dependencies)
    assert.equal(result.exitCode, 40)
    assert.equal(result.envelope, null)
    assert.deepEqual(harness.telemetry, {
      prepared: 1, treeReads: 1, queried: 1, released: 1, closed: 1,
    })
  } finally { await harness.cleanup() }
})

test("cancellation after publication invalidates the artifact and retains the lock", async () => {
  const harness = await createRecoveryClassificationHarness()
  try {
    const writeArtifact = harness.dependencies.writeArtifact
    const dependencies = { ...harness.dependencies,
      writeArtifact: async (...args: Parameters<typeof writeArtifact>) => {
        const artifact = await writeArtifact(...args)
        harness.abort()
        return artifact
      } }
    const result = await runRecoveryClassificationProgram([
      "--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn",
    ], process.cwd(), dependencies)
    assert.equal(result.exitCode, 40)
    assert.equal(result.envelope, null)
    assert.equal(harness.telemetry.released, 0)
    const run = (await readdir(harness.receiptRoot))[0]
    assert.deepEqual((await readdir(`${harness.receiptRoot}/${run}`)).sort(),
      ["classification.invalidated.json", "receipt.ndjson"])
  } finally { await harness.cleanup() }
})

test("receipt publication, lock release, and provider close failures are manual", async () => {
  for (const fault of ["receipt", "lock", "lock_loss", "provider"] as const) {
    const harness = await createRecoveryClassificationHarness()
    try {
      const dependencies = { ...harness.dependencies }
      if (fault === "receipt") dependencies.writeArtifact = async () => {
        throw new Error("injected receipt failure")
      }
      if (fault === "lock") harness.runtime.lock.release = async () => {
        throw new Error("injected release failure")
      }
      if (fault === "lock_loss") harness.loseLock()
      if (fault === "provider") harness.runtime.provider = {
        ...harness.runtime.provider,
        close: async () => { throw new Error("injected close failure") },
      }
      const result = await runRecoveryClassificationProgram([
        "--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn",
      ], process.cwd(), dependencies)
      assert.equal(result.exitCode, 40, fault)
      assert.equal(result.stderrCode, "MANUAL_RECONCILIATION_REQUIRED", fault)
      assert.equal(harness.telemetry.queried, 1, fault)
      if (fault === "lock") {
        const run = (await readdir(harness.receiptRoot))[0]
        assert.deepEqual((await readdir(`${harness.receiptRoot}/${run}`)).sort(),
          ["classification.invalidated.json", "receipt.ndjson"])
      }
    } finally { await harness.cleanup() }
  }
})
