import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"

import { acquireCanaryControlLock } from "./acquire_canary_control_lock.ts"
import { createProgramHarness } from "./create_program_harness.test_fixture.ts"
import { runCanaryControlProgram } from "./run_canary_control_program.ts"
import { sha256Text } from "./sha256_text.ts"

const argv = ["--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn"]

test("pending real-holder SIGKILL cannot authorize a success artifact", async () => {
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const harness = await createProgramHarness()
    const runtimeRoot = await mkdtemp(join(tmpdir(), "momi-program-lock-race-"))
    const realLock = await acquireCanaryControlLock({
      PATH: process.env.PATH, XDG_RUNTIME_DIR: runtimeRoot,
    })
    harness.source.input.runtime.lock = realLock
    const dependencies = {
      ...harness.dependencies,
      writeFinalArtifact: async (...parameters: Parameters<
        typeof harness.dependencies.writeFinalArtifact
      >) => {
        const receipt = await harness.dependencies.writeFinalArtifact(...parameters)
        if (!parameters[1]?.preservedInvalidated) {
          process.kill(realLock.holderPid, "SIGKILL")
        }
        return receipt
      },
    }
    try {
      const result = await runCanaryControlProgram(
        argv, harness.repositoryRoot, dependencies,
      )
      assert.equal(result.exitCode, 40)
      assert.equal(result.envelope?.status, "manual_reconciliation_required")
      assert.equal(realLock.status(), "lost")
      assert.equal(realLock.lossSignal.aborted, true)
      const finalPath = result.envelope!.finalReceiptPath
      const directory = dirname(finalPath)
      assert.deepEqual((await readdir(directory)).sort(),
        ["final.invalidated.json", "final.json", "receipt.ndjson"])
      const authoritativeBytes = await readFile(finalPath, "utf8")
      const authoritative = JSON.parse(authoritativeBytes)
      const invalidatedBytes = await readFile(
        join(directory, "final.invalidated.json"), "utf8",
      )
      assert.equal(authoritative.terminal.status, "manual_reconciliation_required")
      assert.equal(authoritative.terminal.reason, "lifecycle_lock_lost")
      assert.notEqual(sha256Text(invalidatedBytes), result.envelope!.finalReceiptSha256)
      assert.equal(sha256Text(authoritativeBytes), result.envelope!.finalReceiptSha256)
    } finally {
      try { await realLock.release() } catch { /* expected after the reproduction */ }
      await harness.source.cleanup()
      await rm(runtimeRoot, { recursive: true, force: true })
    }
  }
})
