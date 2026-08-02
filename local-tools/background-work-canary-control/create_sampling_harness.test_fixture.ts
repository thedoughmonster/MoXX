import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { appendReceipt } from "./append_receipt.ts"
import { buildTestProviderOutput } from "./build_test_provider_output.test_fixture.ts"
import { createFakeCanaryLock } from "./create_fake_canary_lock.test_fixture.ts"
import { createFakeHeldProvider } from "./create_fake_held_provider.test_fixture.ts"
import { initializeReceipt } from "./initialize_receipt.ts"
import type { SamplingPhaseDependencies } from "./sampling_phase_dependencies.ts"
import type { SchedulerStopReason } from "./schedule_types.ts"
import type { SamplingHarness, SamplingHarnessOptions, SamplingHarnessTelemetry } from "./sampling_test_types.test_fixture.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"
import { ProviderSchemaError } from "./provider_schema_error.ts"
export async function createSamplingHarness(
  options: SamplingHarnessOptions = {},
): Promise<SamplingHarness> {
  const receiptRoot = await mkdtemp(join(tmpdir(), "momi-sampling-orchestrator-"))
  const controller = new AbortController()
  const telemetry: SamplingHarnessTelemetry = {
    nowUtcMs: Date.UTC(2026, 7, 2, 12, 0, 1), randomCalls: 0,
    combinedCalls: 0, appendCalls: 0, releases: 0, providerCloses: 0,
    providerKinds: [], observedBoundaries: [],
  }
  const fakeLock = createFakeCanaryLock(() => { telemetry.releases += 1 })
  const heldProvider = createFakeHeldProvider({ onClose: () => { telemetry.providerCloses += 1 } })
  const loseLock = fakeLock.lose
  const dependencies: SamplingPhaseDependencies = {
    randomBytes: (size) => {
      if (options.lockLossAt === "identity" && telemetry.randomCalls === 0) loseLock()
      telemetry.randomCalls += 1
      return new Uint8Array(size).fill(telemetry.randomCalls)
    },
    initializeReceipt,
    appendReceipt: async (state, receipt) => {
      telemetry.appendCalls += 1
      if ((options.lockLossAt === "run_started_receipt" &&
        receipt.event_type === "run_started") ||
        (options.lockLossAt === "bootstrap_receipt" &&
        receipt.event_type === "guard_heartbeat") ||
        (options.lockLossAt === "sampling_receipt" &&
          ["fast_sample", "resource_sample"].includes(receipt.event_type) &&
          telemetry.combinedCalls > 0)) loseLock()
      if (options.receiptFailureAt === telemetry.appendCalls) {
        state.poisoned = true
        throw new Error("injected receipt failure")
      }
      return await appendReceipt(state, receipt)
    },
    verifyReceipt: async (path) => {
      if (options.lockLossAt === "receipt_verification") loseLock()
      return await verifyReceiptFile(path)
    },
    clock: { nowUtcMs: () => telemetry.nowUtcMs },
    timer: { setAt: () => { throw new Error("fake schedule owns time") } },
    query: async (request) => {
      if (request.provider !== heldProvider) throw new Error("Provider identity drifted")
      telemetry.providerKinds.push(request.sql.kind)
      if ((options.lockLossAt === "preflight_resource" &&
        request.sql.kind === "resource_sample") ||
        (options.lockLossAt === "preflight_fast" && request.sql.kind === "fast_sample") ||
        (options.lockLossAt === "bootstrap" && request.sql.kind === "guard_bootstrap") ||
        (options.lockLossAt === "sampling_provider" &&
          request.sql.kind.startsWith("guard_heartbeat_"))) loseLock()
      const failure = options.providerFailure
      const combinedIndex = telemetry.combinedCalls
      if (failure?.kind === request.sql.kind &&
        (failure.combinedIndex === undefined || failure.combinedIndex === combinedIndex)) {
        return { status: "failure", reason: failure.reason, childExitCode: failure.childExitCode, providerCode: failure.providerCode }
      }
      try {
        return { status: "success", value: request.parser(buildTestProviderOutput(
          request.sql.kind, request.sql.sql, telemetry, options,
        )) }
      } catch (error) {
        return error instanceof ProviderSchemaError ? { status: "failure",
          reason: "schema_failure", schemaDiagnostic: error.diagnostic }
          : { status: "failure", reason: "schema_failure" }
      }
    },
    schedule: async (boundaries, scheduler) => {
      for (const boundary of boundaries) {
        if (options.cancelAt === boundary.index || scheduler.signal?.aborted) {
          scheduler.onStop?.("cancelled")
          controller.abort()
          return { status: "stopped", reason: "cancelled" }
        }
        telemetry.nowUtcMs = boundary.scheduledAtUtcMs
        telemetry.observedBoundaries.push(boundary.scheduledAtUtcMs)
        let stage = 0
        let stopReason: SchedulerStopReason | undefined
        let settle: (() => void) | undefined
        const completed = new Promise<void>((resolve) => { settle = resolve })
        const mark = (expected: number) => {
          if (stage !== expected - 1) stopReason = "sample_stage_order_invalid"
          else stage = expected
          if (stopReason || stage === 4) settle?.()
        }
        scheduler.launch(boundary, {
          providerComplete: () => mark(1), parseComplete: () => mark(2),
          evaluateComplete: () => mark(3), receiptComplete: () => mark(4),
          stopAfterReceipt: () => {
            mark(4)
            stopReason = "sample_lifecycle_failed"
            settle?.()
          },
          fail: () => { stopReason = "sample_lifecycle_failed"; settle?.() },
        })
        await completed
        if (stopReason) {
          scheduler.onStop?.(stopReason)
          return { status: "stopped", reason: stopReason }
        }
      }
      return { status: "completed" }
    },
  }
  return {
    telemetry, dependencies, loseLock,
    input: {
      repositoryRoot: "/trusted/repository", receiptRoot,
      signal: controller.signal,
      runtime: {
        options: { environment: "dev", projectRef: "xtbraqnlskmqxinjxxdn" },
        repository: {
          nodeVersion: "24.14.0", pnpmVersion: "11.7.0",
          supabaseCliVersion: "2.109.1", branch: "dev",
          headSha: "9e9425ac63cdfaf2fad0fb8a12b975642221aac9",
          projectRef: "xtbraqnlskmqxinjxxdn",
        },
        executables: {
          gitExecutable: "/trusted/git", pnpmExecutable: "/trusted/pnpm",
          flockExecutable: "/trusted/flock",
        },
        provider: heldProvider,
        lock: fakeLock.lock,
      },
    },
    cleanup: async () => rm(receiptRoot, { recursive: true, force: true }),
  }
}
