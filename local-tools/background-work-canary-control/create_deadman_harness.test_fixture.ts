import { appendReceipt } from "./append_receipt.ts"
import { buildDeadmanReconciliationOutput } from "./build_deadman_reconciliation_output.test_fixture.ts"
import { buildTestProviderOutput } from "./build_test_provider_output.test_fixture.ts"
import { createSamplingHarness } from "./create_sampling_harness.test_fixture.ts"
import type { DeadmanPhaseDependencies,
  DeadmanPhaseHandoff } from "./deadman_phase_types.ts"
import type { DeadmanHarness, DeadmanHarnessOptions,
  DeadmanHarnessTelemetry } from "./deadman_test_types.test_fixture.ts"
import { encodeQueryEnvelope } from "./encode_query_envelope.ts"
import { orchestrateGuardedSampling } from "./orchestrate_guarded_sampling.ts"
import { VALID_CLEANUP_RESULT } from "./recovery_control.test_fixture.ts"
import { CLEANUP_MARKER } from "./recovery_control_constants.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"

export async function createDeadmanHarness(
  options: DeadmanHarnessOptions = {},
): Promise<DeadmanHarness> {
  const kind = options.handoffKind ?? "normal"
  const source = await createSamplingHarness(kind === "ambiguous"
    ? { providerFailure: { kind: "guard_bootstrap", reason: "timed_out" } }
    : kind === "known_failure"
      ? { thresholdAt: 0, providerFailure: { kind: "rollback", reason: "timed_out" } }
      : {})
  const prior = await orchestrateGuardedSampling(source.input, source.dependencies)
  const expectedStatus = kind === "normal"
    ? "sampling_complete_waiting_for_synthetic_loss"
    : kind === "ambiguous"
      ? "bootstrap_ambiguous_deadman_fallback_pending"
      : "sampling_failed_deadman_fallback_pending"
  if (prior.status !== expectedStatus) throw new Error("Sampling handoff fixture failed")
  const handoff = prior as DeadmanPhaseHandoff
  const controller = new AbortController()
  const telemetry: DeadmanHarnessTelemetry = {
    nowUtcMs: source.telemetry.nowUtcMs, monotonicMs: 1_000,
    providerKinds: [], receiptAppends: 0, waitTargets: [],
    releasesAtStart: source.telemetry.releases,
  }
  const dependencies: DeadmanPhaseDependencies = {
    clock: { nowUtcMs: () => telemetry.nowUtcMs },
    monotonicNowMs: () => telemetry.monotonicMs,
    timer: {
      setAt: (utcMs, task) => {
        telemetry.waitTargets.push(utcMs)
        const delay = Math.max(0, utcMs - telemetry.nowUtcMs)
        const launchDelay = options.launchDelayMs ?? 0
        if (options.cancelBeforeDeadline) controller.abort()
        if (options.holderLossAt === "wait") source.loseLock()
        telemetry.monotonicMs += delay + launchDelay
        telemetry.nowUtcMs = utcMs + launchDelay
        queueMicrotask(task)
        return () => undefined
      },
    },
    appendReceipt: async (state, receipt) => {
      telemetry.receiptAppends += 1
      if (options.receiptFailureAt === telemetry.receiptAppends) {
        state.poisoned = true
        throw new Error("injected dead-man receipt failure")
      }
      return await appendReceipt(state, receipt)
    },
    verifyReceipt: async (path) => {
      if (options.verifyFailure) throw new Error("injected verification failure")
      return await verifyReceiptFile(path)
    },
    query: async (request) => {
      if (request.provider !== handoff.runtime.provider) {
        throw new Error("Provider identity drifted")
      }
      telemetry.providerKinds.push(request.sql.kind)
      if ((options.holderLossAt === "reconciliation" &&
        request.sql.kind === "deadman_reconciliation") ||
        (options.holderLossAt === "cleanup" && request.sql.kind === "cleanup") ||
        (options.holderLossAt === "final" && request.sql.kind === "fast_sample")) {
        source.loseLock()
      }
      if (options.providerFailure?.kind === request.sql.kind) {
        return { status: "failure", reason: options.providerFailure.reason }
      }
      try {
        let output: Uint8Array
        if (request.sql.kind === "deadman_reconciliation") {
          output = buildDeadmanReconciliationOutput(
            handoff, telemetry.nowUtcMs, options.guardPresent ?? true,
            options.reconciliationFault,
          )
        } else if (request.sql.kind === "cleanup") {
          const cleanup = options.cleanupActiveRefusal ? {
            ...VALID_CLEANUP_RESULT,
            targetJobs: VALID_CLEANUP_RESULT.targetJobs.map((job, index) =>
              index === 0 ? { ...job, active: true } : job),
          } : VALID_CLEANUP_RESULT
          output = encodeQueryEnvelope(CLEANUP_MARKER, cleanup)
        } else {
          source.telemetry.nowUtcMs = telemetry.nowUtcMs
          output = buildTestProviderOutput(
            request.sql.kind, request.sql.sql, source.telemetry, {},
          )
          const envelope = JSON.parse(new TextDecoder().decode(output))
          const sample = envelope[0].sample
          if (request.sql.kind === "fast_sample" && options.finalReadyDecrease) {
            sample.toastReady = 0
          }
          if (request.sql.kind === "resource_sample" && options.finalResourceGrowth) {
            sample.databaseBytes = handoff.resourceBaseline.databaseBytes + 200_000_000
          }
          output = new TextEncoder().encode(`${JSON.stringify(envelope)}\n`)
        }
        return { status: "success", value: request.parser(output) }
      } catch {
        return { status: "failure", reason: "schema_failure" }
      }
    },
  }
  return {
    input: { handoff, signal: controller.signal }, dependencies, telemetry,
    sourceReleases: () => source.telemetry.releases,
    cleanup: source.cleanup,
  }
}
