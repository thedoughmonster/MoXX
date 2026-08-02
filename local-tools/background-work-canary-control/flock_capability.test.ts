import assert from "node:assert/strict"
import { test } from "node:test"

import type { BoundedChildResult, CanaryControlLock } from "./process_types.ts"
import { selfTestFlockCapability } from "./self_test_flock_capability.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"
import type { FlockSelfTestDependencies } from "./setup_preflight_types.ts"

const identity = { path: "/usr/bin/flock", device: 1n, inode: 2n, size: 3n }

function fakeDependencies(overrides: Partial<FlockSelfTestDependencies> = {}):
FlockSelfTestDependencies {
  let held = false
  let probes = 0
  const child = (exitCode: number): BoundedChildResult => ({
    outcome: { status: exitCode === 0 ? "success" : "exit_failure", exitCode,
      signal: null, stdoutBytes: 0, stderrBytes: 0, limitedStream: null },
    stdout: new Uint8Array(), stderr: new Uint8Array(),
  })
  const lock: CanaryControlLock = {
    flockPath: "/usr/bin/flock", lockPath: "/tmp/private/lock", holderPid: 1,
    lossSignal: new AbortController().signal,
    status: () => held ? "held" : "released",
    release: async () => { held = false },
  }
  return {
    inspect: async () => identity,
    createFixture: async () => ({ directory: "/tmp/private", lockPath: "/tmp/private/lock",
      cleanup: async () => {} }),
    acquire: async () => { held = true; return lock },
    runProbe: async () => child(probes++ === 0 ? 73 : 0),
    ...overrides,
  }
}

test("proves the canonical flock capability fully offline with fakes", async () => {
  const result = await selfTestFlockCapability("/usr/bin/flock", fakeDependencies())
  assert.equal(result.executablePath, "/usr/bin/flock")
  assert.equal(result.conflictRefused, true)
  assert.equal(result.reacquired, true)
  assert.match(result.identitySha256, /^[0-9a-f]{64}$/)
})

test("rejects missing, unsafe, drifted, and conflict-broken flock capabilities", async () => {
  await assert.rejects(selfTestFlockCapability("/usr/local/bin/flock",
    fakeDependencies()), SetupPreflightError)
  let inspections = 0
  await assert.rejects(selfTestFlockCapability("/usr/bin/flock", fakeDependencies({
    inspect: async () => inspections++ === 0 ? identity : { ...identity, inode: 9n },
  })), /FlockIdentityDrift/)
  await assert.rejects(selfTestFlockCapability("/usr/bin/flock", fakeDependencies({
    runProbe: async () => ({
      outcome: { status: "success", exitCode: 0, signal: null,
        stdoutBytes: 0, stderrBytes: 0, limitedStream: null },
      stdout: new Uint8Array(), stderr: new Uint8Array(),
    }),
  })), /FlockConflictTestFailed/)
})

test("rejects lock release and deterministic cleanup failures", async () => {
  const badRelease = fakeDependencies({
    acquire: async () => ({
      flockPath: "/usr/bin/flock", lockPath: "/tmp/private/lock", holderPid: 1,
      lossSignal: new AbortController().signal, status: () => "held",
      release: async () => { throw new Error("release") },
    }),
  })
  await assert.rejects(selfTestFlockCapability("/usr/bin/flock", badRelease),
    /FlockReleaseFailed/)
  const badCleanup = fakeDependencies({
    createFixture: async () => ({ directory: "/tmp/private", lockPath: "/tmp/private/lock",
      cleanup: async () => { throw new Error("cleanup") } }),
  })
  await assert.rejects(selfTestFlockCapability("/usr/bin/flock", badCleanup),
    /FlockCleanupFailed/)
})
