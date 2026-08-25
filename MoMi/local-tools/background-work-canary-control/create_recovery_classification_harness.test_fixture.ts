import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createFakeCanaryLock } from "./create_fake_canary_lock.test_fixture.ts"
import { createFakeHeldProvider } from "./create_fake_held_provider.test_fixture.ts"
import { createRecoveryClassificationDependencies } from "./create_recovery_classification_dependencies.ts"
import { createRecoverySnapshotFixture } from "./create_recovery_snapshot.test_fixture.ts"
import { encodeQueryEnvelope } from "./encode_query_envelope.ts"
import { initializeRecoveryState } from "./initialize_recovery_state.ts"
import { RECOVERY_PREFLIGHT_MARKER } from "./recovery_constants.ts"
import { RECOVERY_SNAPSHOT_KEYS } from "./recovery_snapshot_keys.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"

export async function createRecoveryClassificationHarness() {
  const root = await mkdtemp(join(tmpdir(), "momi-recovery-classification-"))
  const receiptRoot = join(root, "receipts")
  await mkdir(receiptRoot, { mode: 0o700 })
  const telemetry = { prepared: 0, treeReads: 0, queried: 0, released: 0, closed: 0 }
  const inactive = createRecoverySnapshotFixture().targetJobs.map((job) => ({
    ...job, active: false,
  }))
  const snapshot = createRecoverySnapshotFixture({ targetJobs: inactive,
    guardIdentityCount: 0, activeCronExecutions: 0 })
  const sample = Object.fromEntries(RECOVERY_SNAPSHOT_KEYS.map((key) => [key, snapshot[key]]))
  const stdout = encodeQueryEnvelope(RECOVERY_PREFLIGHT_MARKER, sample)
  const provider = createFakeHeldProvider({ runQuery: async (request) => {
    telemetry.queried += 1
    if (request.signal?.aborted) return { outcome: { status: "cancelled" as const,
      exitCode: null, signal: null, stdoutBytes: 0, stderrBytes: 0,
      limitedStream: null }, stdout: new Uint8Array(), stderr: new Uint8Array() }
    return { outcome: { status: "success" as const, exitCode: 0, signal: null,
      stdoutBytes: stdout.byteLength, stderrBytes: 0, limitedStream: null },
      stdout, stderr: new Uint8Array() }
  }, onClose: () => { telemetry.closed += 1 } })
  const fakeLock = createFakeCanaryLock(() => { telemetry.released += 1 })
  const setupStarted = "2026-08-05T00:00:00.000Z"
  const runtime: ReleasedRuntime = {
    options: { environment: "dev", projectRef: "xtbraqnlskmqxinjxxdn" },
    repository: { nodeVersion: "24.14.0", pnpmVersion: "11.7.0",
      supabaseCliVersion: "2.109.1", branch: "dev", headSha: "a".repeat(40),
      projectRef: "xtbraqnlskmqxinjxxdn" },
    executables: { gitExecutable: "/trusted/git", pnpmExecutable: "/trusted/pnpm",
      flockExecutable: "/trusted/flock" }, provider, lock: fakeLock.lock,
    setupReceipt: { schemaVersion: 1, status: "ready", stage: "receipt",
      startedAtUtc: setupStarted, expiresAtUtc: "2026-08-05T00:30:00.000Z",
      durationMs: 10, providerWorkBegan: true, hostedMutationPossible: false,
      completedStages: ["repository", "flock", "link", "linkage", "receipt"],
      receiptPath: join(root, "setup.json"), releaseSha: "a".repeat(40),
      projectIdentitySha256: "c".repeat(64), linkageIdentitySha256: "d".repeat(64),
      flockCapabilitySha256: "e".repeat(64), queryIdentitySha256: "f".repeat(64),
      nativeCliSha256: "1".repeat(64), nodeVersion: "24.14.0", pnpmVersion: "11.7.0",
      supabaseCliVersion: "2.109.1", integritySha256: "2".repeat(64),
      receiptSha256: "3".repeat(64) },
  }
  const signal = new AbortController()
  const dependencies = { ...createRecoveryClassificationDependencies(),
    prepareRuntime: async () => { telemetry.prepared += 1; return runtime },
    collectReleaseTree: async () => { telemetry.treeReads += 1; return "b".repeat(40) },
    prepareState: async (prepared: ReleasedRuntime, repositoryRoot: string,
      combinedSignal: AbortSignal) => initializeRecoveryState(
        prepared, repositoryRoot, receiptRoot, combinedSignal,
      ),
    installSignalHandlers: () => ({ signal: signal.signal,
      signalCount: () => signal.signal.aborted ? 1 : 0, remove: () => undefined }),
    nowUtcMs: () => Date.now(),
  }
  return { root, receiptRoot, runtime, dependencies, telemetry, abort: () => signal.abort(),
    loseLock: fakeLock.lose,
    cleanup: async () => rm(root, { recursive: true, force: true }) }
}
