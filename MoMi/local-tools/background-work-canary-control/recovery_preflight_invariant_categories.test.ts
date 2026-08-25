import assert from "node:assert/strict"
import test from "node:test"

import { createFakeHeldProvider } from "./create_fake_held_provider.test_fixture.ts"
import { createRecoverySnapshotFixture } from "./create_recovery_snapshot.test_fixture.ts"
import { encodeQueryEnvelope } from "./encode_query_envelope.ts"
import { RECOVERY_PREFLIGHT_MARKER } from "./recovery_constants.ts"
import { RECOVERY_SNAPSHOT_KEYS } from "./recovery_snapshot_keys.ts"
import { RecoveryPreflightFailureError } from "./recovery_preflight_failure_error.ts"
import { runRecoveryPreflight } from "./run_recovery_preflight.ts"

const changes = [
  ["work", { toastUnmatched: 1 }], ["control", { waitingLocks: 1 }],
  ["cohort", { cohortAmbiguous: 1 }],
  ["routes", { activeRoutingRouteCount: 0 }], ["safety", { queueDead: 1 }],
] as const

test("each accepted invariant group survives validation as its safe reason", async () => {
  const fixture = createRecoverySnapshotFixture()
  const inactive = fixture.targetJobs.map((job) => ({ ...job, active: false }))
  for (const [expected, change] of changes) {
    const snapshot = createRecoverySnapshotFixture({ guardIdentityCount: 0,
      targetJobs: inactive, ...change })
    const body = Object.fromEntries(RECOVERY_SNAPSHOT_KEYS.map((key) => [key, snapshot[key]]))
    const stdout = encodeQueryEnvelope(RECOVERY_PREFLIGHT_MARKER, body)
    const provider = createFakeHeldProvider({ runQuery: async () => ({ outcome: {
      status: "success", exitCode: 0, signal: null, stdoutBytes: stdout.byteLength,
      stderrBytes: 0, limitedStream: null }, stdout, stderr: new Uint8Array() }) })
    const state = { repositoryRoot: process.cwd(), signal: new AbortController().signal,
      runtime: { provider } } as never
    await assert.rejects(runRecoveryPreflight(state), (error: Error) =>
      error instanceof RecoveryPreflightFailureError &&
      error.failure.stage === "invariant_validation" &&
      error.failure.reasonCategory === expected &&
      error.failure.invariantGroups?.[expected] === true)
  }
})
