import { installBoundedSignalHandlers } from "./install_bounded_signal_handlers.ts"
import { createProgramDeadmanDependencies } from "./create_program_deadman_dependencies.test_fixture.ts"
import { createSamplingHarness } from "./create_sampling_harness.test_fixture.ts"
import { orchestrateDeadmanReconciliation } from "./orchestrate_deadman_reconciliation.ts"
import { orchestrateGuardedSampling } from "./orchestrate_guarded_sampling.ts"
import { parsePublicInvocation } from "./parse_public_invocation.ts"
import { invalidateFinalArtifact } from "./invalidate_final_artifact.ts"
import type { CanaryProgramDependencies,
  SignalSource } from "./program_types.ts"
import type { SamplingHarnessOptions } from "./sampling_test_types.test_fixture.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"
import { writeFinalArtifact } from "./write_final_artifact.ts"

export type ProgramHarnessMode =
  | "ambiguous"
  | "deadman_fallback"
  | "manual"
  | "normal"
  | "pre_guard"
  | "rollback"

export async function createProgramHarness(
  options: {
    mode?: ProgramHarnessMode
    signalAt?: "loss" | "sampling"
    failFinalArtifact?: boolean
    finalizationFailure?: "artifact" | "receipt"
    lockLossAt?: "before_final_publish" | "before_release"
  } = {},
): Promise<{
  dependencies: CanaryProgramDependencies
  repositoryRoot: string
  source: Awaited<ReturnType<typeof createSamplingHarness>>
  deadmanProviderKinds: string[]
  emitSignal: (signal: "SIGINT" | "SIGTERM") => void
  activeSignalListeners: () => number
}> {
  const mode = options.mode ?? "normal"
  const samplingOptions: SamplingHarnessOptions = mode === "pre_guard"
    ? { providerFailure: { kind: "resource_sample", reason: "exit_failure" } }
    : mode === "rollback"
      ? { thresholdAt: 0 }
      : mode === "deadman_fallback"
        ? { thresholdAt: 0,
            providerFailure: { kind: "rollback", reason: "timed_out" } }
        : mode === "ambiguous"
          ? { providerFailure: { kind: "guard_bootstrap", reason: "timed_out" } }
          : {}
  const source = await createSamplingHarness(samplingOptions)
  const listeners = {
    SIGINT: new Set<() => void>(),
    SIGTERM: new Set<() => void>(),
  }
  const signalSource: SignalSource = {
    on: (event, listener) => { listeners[event].add(listener) },
    off: (event, listener) => { listeners[event].delete(listener) },
  }
  const emitSignal = (signal: "SIGINT" | "SIGTERM") => {
    for (const listener of listeners[signal]) listener()
  }
  const deadmanProviderKinds: string[] = []
  const dependencies: CanaryProgramDependencies = {
    prepareRuntime: async (args) => {
      parsePublicInvocation(args)
      return source.input.runtime
    },
    prepareReceiptRoot: async () => source.input.receiptRoot,
    runSampling: async (runtime, repositoryRoot, receiptRoot, signal) => {
      if (options.signalAt === "sampling") emitSignal("SIGTERM")
      return await orchestrateGuardedSampling({
        runtime, repositoryRoot, receiptRoot, signal, deferLockRelease: true,
      }, source.dependencies)
    },
    runDeadman: async (handoff, signal) => {
      const harness = createProgramDeadmanDependencies(handoff, source.telemetry, {
        reconciliationFailure: mode === "manual",
        guardPresent: true,
      })
      if (options.signalAt === "loss") {
        emitSignal("SIGINT")
        emitSignal("SIGTERM")
      }
      const result = await orchestrateDeadmanReconciliation(
        { handoff, signal, deferLockRelease: true }, harness.dependencies,
      )
      deadmanProviderKinds.push(...harness.providerKinds)
      return result
    },
    appendReceipt: async (state, input) => {
      if (options.finalizationFailure === "receipt" &&
        input.metrics.error_class === "finalization_lock_lost") {
        state.poisoned = true
        throw new Error("injected finalization receipt failure")
      }
      return await source.dependencies.appendReceipt(state, input)
    },
    verifyReceipt: verifyReceiptFile,
    writeFinalArtifact: async (input, finalOptions) => {
      if (options.failFinalArtifact ||
        (options.finalizationFailure === "artifact" &&
          input.status === "manual_reconciliation_required" &&
          finalOptions?.preservedInvalidated)) throw new Error("injected artifact failure")
      const result = await writeFinalArtifact(input, {
        ...finalOptions,
        beforePublish: () => {
          if (options.lockLossAt === "before_final_publish") source.loseLock()
          finalOptions?.beforePublish?.()
        },
      })
      if (options.lockLossAt === "before_release" &&
        input.status !== "manual_reconciliation_required") source.loseLock()
      return result
    },
    invalidateFinalArtifact,
    installSignalHandlers: () => installBoundedSignalHandlers(signalSource),
    nowUtcMs: () => source.telemetry.nowUtcMs,
  }
  return {
    dependencies, repositoryRoot: source.input.repositoryRoot,
    source, deadmanProviderKinds, emitSignal,
    activeSignalListeners: () => listeners.SIGINT.size + listeners.SIGTERM.size,
  }
}
