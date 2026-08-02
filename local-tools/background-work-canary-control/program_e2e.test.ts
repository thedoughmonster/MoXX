import assert from "node:assert/strict"
import { test } from "node:test"

import { createProgramHarness,
  type ProgramHarnessMode } from "./create_program_harness.test_fixture.ts"
import { emitProgramResult } from "./emit_program_result.ts"
import { runCanaryControlProgram } from "./run_canary_control_program.ts"

const argv = ["--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn"]

test("argv reaches every fixed offline phase and maps exact terminal exits", async () => {
  const cases: readonly [ProgramHarnessMode, number, string][] = [
    ["normal", 0, "inactive_dry_run_verified"],
    ["pre_guard", 20, "pre_guard_failure"],
    ["rollback", 30, "sampling_failed_rollback_completed"],
    ["deadman_fallback", 30, "failure_recovered_by_deadman"],
    ["ambiguous", 30, "bootstrap_ambiguity_reconciled"],
    ["manual", 40, "manual_reconciliation_required"],
  ]
  for (const [mode, exitCode, status] of cases) {
    const harness = await createProgramHarness({ mode })
    try {
      const result = await runCanaryControlProgram(
        argv, harness.repositoryRoot, harness.dependencies,
      )
      assert.equal(result.exitCode, exitCode, mode)
      assert.equal(result.envelope?.status, status, mode)
      assert.equal(harness.source.telemetry.releases, exitCode === 40 ? 0 : 1, mode)
      assert.equal(harness.activeSignalListeners(), 0, mode)
    } finally {
      await harness.source.cleanup()
    }
  }
})

test("signals stop sampling safely and cannot bypass synthetic-loss reconciliation", async () => {
  const sampling = await createProgramHarness({ signalAt: "sampling" })
  try {
    const result = await runCanaryControlProgram(
      argv, sampling.repositoryRoot, sampling.dependencies,
    )
    assert.equal(result.exitCode, 30)
    assert.equal(result.envelope?.status, "sampling_failed_rollback_completed")
    assert.equal(sampling.source.telemetry.providerKinds.includes("rollback"), true)
  } finally {
    await sampling.source.cleanup()
  }
  const loss = await createProgramHarness({ signalAt: "loss" })
  try {
    const result = await runCanaryControlProgram(
      argv, loss.repositoryRoot, loss.dependencies,
    )
    assert.equal(result.exitCode, 0)
    assert.deepEqual(loss.deadmanProviderKinds, [
      "deadman_reconciliation", "cleanup", "fast_sample", "resource_sample",
    ])
    assert.equal(loss.source.telemetry.providerKinds.some((kind) =>
      kind.startsWith("guard_heartbeat") && kind.endsWith("resource")), true)
    assert.equal(loss.activeSignalListeners(), 0)
  } finally {
    await loss.source.cleanup()
  }
})

test("terminal IO is one canonical bounded envelope plus a fixed reason code", async () => {
  const harness = await createProgramHarness({ mode: "ambiguous" })
  try {
    const result = await runCanaryControlProgram(
      argv, harness.repositoryRoot, harness.dependencies,
    )
    let stdout = ""
    let stderr = ""
    emitProgramResult(result, {
      stdout: (value) => { stdout += value },
      stderr: (value) => { stderr += value },
    })
    assert.equal(stdout.trim().split("\n").length, 1)
    assert.deepEqual(Object.keys(JSON.parse(stdout)).sort(), [
      "finalReceiptPath", "finalReceiptSha256", "runId", "status",
    ])
    assert.equal(stderr, "RECOVERED_BUT_UNSUCCESSFUL\n")
    assert.doesNotMatch(`${stdout}${stderr}`,
      /token|postgresql:|https?:|select |supabase db|stack|injected/i)
  } finally {
    await harness.source.cleanup()
  }
})

test("unknown public argv fails before provider work and emits no envelope", async () => {
  const harness = await createProgramHarness()
  try {
    const result = await runCanaryControlProgram(
      [...argv, "--threshold", "1"], harness.repositoryRoot, harness.dependencies,
    )
    assert.deepEqual(result, {
      exitCode: 20, stderrCode: "PRE_GUARD_FAILURE", envelope: null,
    })
    assert.deepEqual(harness.source.telemetry.providerKinds, [])
  } finally {
    await harness.source.cleanup()
  }
})
