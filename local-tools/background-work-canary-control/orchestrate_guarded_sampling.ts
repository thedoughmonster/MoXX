import { buildGuardedSamplingContext } from "./build_guarded_sampling_context.ts"
import { coordinateSamplingFailure } from "./coordinate_sampling_failure.ts"
import { createSamplingIdentity } from "./create_sampling_identity.ts"
import { runGuardBootstrap } from "./run_guard_bootstrap.ts"
import { runPreGuardBaselines } from "./run_pre_guard_baselines.ts"
import { runSamplingBoundaries } from "./run_sampling_boundaries.ts"
import type { SamplingExecutionState } from "./sampling_execution_state.ts"
import type { SamplingPhaseDependencies,
  SamplingPhaseInput } from "./sampling_phase_dependencies.ts"
import { SamplingPhaseError } from "./sampling_phase_error.ts"
import { assertSamplingLockHeld } from "./assert_sampling_lock_held.ts"
import type { SamplingPhaseResult } from "./sampling_phase_types.ts"

export async function orchestrateGuardedSampling(
  input: SamplingPhaseInput,
  dependencies: SamplingPhaseDependencies,
): Promise<SamplingPhaseResult> {
  const state: SamplingExecutionState = {
    runtime: input.runtime, repositoryRoot: input.repositoryRoot,
    receiptRoot: input.receiptRoot,
    signal: AbortSignal.any([
      input.runtime.lock.lossSignal,
      ...(input.signal ? [input.signal] : []),
    ]),
    deferLockRelease: input.deferLockRelease === true,
    guardMayExist: false,
    lockLossObserved: false,
    samplesCompleted: 0, resourceSamplesCompleted: 0,
    lastObservedAtUtcMs: null, stopReasons: [],
  }
  try {
    assertSamplingLockHeld(state, "identity")
    let identity
    try {
      identity = createSamplingIdentity(dependencies.randomBytes)
    } catch {
      throw new SamplingPhaseError("identity", "identity_failure")
    }
    state.runId = identity.runId
    state.currentGenerationSha256 = identity.generationSha256
    assertSamplingLockHeld(state, "identity")
    try {
      state.receipt = await dependencies.initializeReceipt(input.receiptRoot, identity.runId)
      await dependencies.appendReceipt(state.receipt, {
        event_type: "run_started",
        timestamp_utc: new Date(dependencies.clock.nowUtcMs()).toISOString(),
        metrics: {
          project_ref: input.runtime.options.projectRef,
          status: "started",
        },
      })
      assertSamplingLockHeld(state, "receipt")
    } catch {
      assertSamplingLockHeld(state, "receipt")
      throw new SamplingPhaseError("receipt", "receipt_failure")
    }
    const baselines = await runPreGuardBaselines(state, dependencies)
    assertSamplingLockHeld(state, "preflight_fast")
    state.workBaseline = baselines.work
    state.resourceBaseline = baselines.resource
    await runGuardBootstrap(state, dependencies)
    assertSamplingLockHeld(state, "bootstrap")
    const sampling = await runSamplingBoundaries(state, dependencies)
    assertSamplingLockHeld(state, "sampling")
    state.currentGenerationSha256 = sampling.currentGenerationSha256
    state.samplesCompleted = sampling.samplesCompleted
    state.resourceSamplesCompleted = sampling.resourceSamplesCompleted
    state.lastObservedAtUtcMs = sampling.lastObservedAtUtcMs
    state.stopReasons = sampling.status === "failed" ? sampling.stopReasons : []
    if (sampling.status === "failed") {
      throw new SamplingPhaseError(sampling.stage, sampling.reason)
    }
    if (!state.receipt) throw new SamplingPhaseError("receipt", "receipt_failure")
    try {
      await dependencies.verifyReceipt(state.receipt.path)
      assertSamplingLockHeld(state, "receipt")
    } catch {
      assertSamplingLockHeld(state, "receipt")
      throw new SamplingPhaseError("receipt", "receipt_failure")
    }
    return {
      ...buildGuardedSamplingContext(state),
      status: "sampling_complete_waiting_for_synthetic_loss",
      startBoundaryUtcMs: state.startBoundaryUtcMs!,
      samplesCompleted: 21,
      resourceSamplesCompleted: 6,
    }
  } catch (error) {
    return await coordinateSamplingFailure(state, dependencies, error)
  }
}
