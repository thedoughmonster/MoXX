import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import { loadSealedSampleArtifact } from "./load_sealed_sample_artifact.ts"
import { parseFastQueryOutput } from "./parse_fast_query_output.ts"
import { parsePreGuardWorkBaseline } from "./parse_pre_guard_work_baseline.ts"
import { parseResourceBaselineOutput } from "./parse_resource_baseline_output.ts"
import { parseResourceQueryPayload } from "./parse_resource_query_payload.ts"
import type { SamplingExecutionState } from "./sampling_execution_state.ts"
import type { SamplingPhaseDependencies } from "./sampling_phase_dependencies.ts"
import { SamplingPhaseError } from "./sampling_phase_error.ts"
import type { PreGuardBaselines } from "./sampling_stage_types.ts"
import { assertSamplingLockHeld } from "./assert_sampling_lock_held.ts"

export async function runPreGuardBaselines(
  state: SamplingExecutionState,
  dependencies: SamplingPhaseDependencies,
): Promise<PreGuardBaselines> {
  if (!state.receipt) throw new SamplingPhaseError("receipt", "receipt_failure")
  assertSamplingLockHeld(state, "preflight_resource")
  const common = {
    repositoryRoot: state.repositoryRoot,
    provider: state.runtime.provider,
    signal: state.signal,
  }
  const resource = await dependencies.query({
    ...common,
    sql: createInternalProviderSql("resource_sample", loadSealedSampleArtifact("resource")),
    parser: (stdout) => ({
      baseline: parseResourceBaselineOutput(stdout),
      observedAtUtcMs: parseResourceQueryPayload(stdout).observedAtUtcMs,
    }),
  })
  if (resource.status === "failure") {
    assertSamplingLockHeld(state, "preflight_resource")
    throw new SamplingPhaseError("preflight_resource", resource.reason)
  }
  assertSamplingLockHeld(state, "preflight_resource")
  try {
    await dependencies.appendReceipt(state.receipt, {
      event_type: "resource_sample",
      timestamp_utc: new Date(resource.value.observedAtUtcMs).toISOString(),
      metrics: {
        sample_kind: "resource", status: "passed",
        resources: {
          database_bytes: resource.value.baseline.databaseBytes,
          cron_history_bytes: resource.value.baseline.cronHistoryBytes,
          deadlocks: resource.value.baseline.deadlocks,
        },
      },
    })
    assertSamplingLockHeld(state, "receipt")
  } catch {
    assertSamplingLockHeld(state, "receipt")
    throw new SamplingPhaseError("receipt", "receipt_failure")
  }
  const fast = await dependencies.query({
    ...common,
    sql: createInternalProviderSql("fast_sample", loadSealedSampleArtifact("fast")),
    parser: (stdout) => parseFastQueryOutput(stdout, {
      expectedGuardPresent: false,
      startCronRunId: resource.value.baseline.maxCronRunId,
      missedSamples: 0,
      overlappingSamples: 0,
    }),
  })
  if (fast.status === "failure") {
    assertSamplingLockHeld(state, "preflight_fast")
    throw new SamplingPhaseError("preflight_fast", fast.reason)
  }
  assertSamplingLockHeld(state, "preflight_fast")
  let work
  try {
    if (fast.value.observedAtUtcMs < resource.value.observedAtUtcMs) throw new Error()
    work = parsePreGuardWorkBaseline({ guardPresent: false, sample: fast.value })
    await dependencies.appendReceipt(state.receipt, {
      event_type: "work_baseline",
      timestamp_utc: new Date(fast.value.observedAtUtcMs).toISOString(),
      metrics: {
        status: "passed",
        target: { active: false, active_cron_executions: fast.value.activeCronExecutions },
        queues: {
          toast_ready: work.toastReady, routing_ready: work.routingReady,
          delivery_ready: work.deliveryReady, queue_ready: work.queueReady,
        },
      },
    })
    assertSamplingLockHeld(state, "receipt")
  } catch (error) {
    assertSamplingLockHeld(state, "receipt")
    if (state.receipt.poisoned) {
      throw new SamplingPhaseError("receipt", "receipt_failure")
    }
    throw new SamplingPhaseError("preflight_fast", "preflight_rejected")
  }
  return {
    work, resource: resource.value.baseline, fastSample: fast.value,
    resourceObservedAtUtcMs: resource.value.observedAtUtcMs,
  }
}
