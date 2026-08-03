import assert from "node:assert/strict"
import test from "node:test"

import { createFakeHeldProvider } from "./create_fake_held_provider.test_fixture.ts"
import type { BoundedChildStatus } from "./process_types.ts"
import { RecoveryPreflightFailureError } from "./recovery_preflight_failure_error.ts"
import { runRecoveryPreflight } from "./run_recovery_preflight.ts"

const cases = [
  ["adapter", "adapter"], ["exit_failure", "exit"],
  ["provider_category", "provider_category"], ["output_limit", "output_limit"],
  ["timed_out", "timeout"], ["cancelled", "cancelled"],
  ["signalled", "signalled"], ["success", "parse_schema"],
] as const

test("provider and parse failures retain their closed-set preflight category", async () => {
  for (const [fault, expected] of cases) {
    const provider = createFakeHeldProvider({ runQuery: async () => {
      if (fault === "adapter") throw new Error("private adapter failure")
      const status = (fault === "provider_category" ? "exit_failure" : fault) as BoundedChildStatus
      const stderr = fault === "provider_category"
        ? new TextEncoder().encode("ERROR:  momi_guard_heartbeat_expired\n")
        : new TextEncoder().encode("private provider output")
      const stdout = status === "success" ? new TextEncoder().encode("{}\n") : new Uint8Array()
      return { outcome: { status, exitCode: status === "exit_failure" ? 7 :
        status === "success" ? 0 : null, signal: null, stdoutBytes: stdout.byteLength,
      stderrBytes: stderr.byteLength, limitedStream: status === "output_limit" ? "stdout" : null },
      stdout, stderr }
    } })
    const state = { repositoryRoot: process.cwd(), signal: new AbortController().signal,
      runtime: { provider } } as never
    await assert.rejects(runRecoveryPreflight(state), (error: Error) =>
      error instanceof RecoveryPreflightFailureError &&
      error.failure.reasonCategory === expected &&
      /^[a-f0-9]{64}$/.test(error.failure.failureFingerprint))
  }
})
