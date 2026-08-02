import { createInternalProviderSql } from "./create_internal_provider_sql.ts"
import type { DeadmanPhaseDependencies,
  DeadmanPhaseHandoff } from "./deadman_phase_types.ts"
import { evaluateDryRunThresholds } from "./evaluate_dry_run_thresholds.ts"
import type { FinalReadbackResult } from "./final_readback_types.ts"
import { loadSealedSampleArtifact } from "./load_sealed_sample_artifact.ts"
import { parseFastQueryOutput } from "./parse_fast_query_output.ts"
import { parseFinalResourceOutput } from "./parse_final_resource_output.ts"
import { parsePreGuardWorkBaseline } from "./parse_pre_guard_work_baseline.ts"

export async function runFinalInactiveReadback(
  handoff: DeadmanPhaseHandoff,
  dependencies: Pick<DeadmanPhaseDependencies, "query" | "appendReceipt">,
): Promise<FinalReadbackResult> {
  const queryBase = {
    repositoryRoot: handoff.repositoryRoot,
    provider: handoff.runtime.provider,
  }
  const fast = await dependencies.query({
    ...queryBase,
    sql: createInternalProviderSql("fast_sample", loadSealedSampleArtifact("fast")),
    parser: (stdout) => parseFastQueryOutput(stdout, {
      expectedGuardPresent: false,
      startCronRunId: handoff.resourceBaseline.maxCronRunId,
      missedSamples: 0, overlappingSamples: 0,
    }),
  })
  if (fast.status === "failure") return { status: "failed", reason: "final_fast_failed" }
  try {
    parsePreGuardWorkBaseline({ guardPresent: false, sample: fast.value })
    const fastReasons = evaluateDryRunThresholds(fast.value, handoff.workBaseline)
      .filter((reason) => reason !== "guard_inactive")
    if (fastReasons.length > 0) throw new Error()
  } catch {
    return { status: "failed", reason: "final_threshold_failed" }
  }
  try {
    await dependencies.appendReceipt(handoff.receipt, {
      event_type: "fast_sample",
      timestamp_utc: new Date(fast.value.observedAtUtcMs).toISOString(),
      metrics: {
        sample_kind: "fast", status: "passed",
        target: {
          active: false, target_run_count: fast.value.targetExecutions,
          target_run_failures: fast.value.targetFailures,
          active_cron_executions: fast.value.activeCronExecutions,
        },
        queues: {
          toast_ready: fast.value.toastReady, routing_ready: fast.value.routingReady,
          delivery_ready: fast.value.deliveryReady, queue_ready: fast.value.queueReady,
          waiting_locks: fast.value.waitingLocks,
        },
      },
    })
  } catch {
    return { status: "failed", reason: "receipt_failure" }
  }
  const resource = await dependencies.query({
    ...queryBase,
    sql: createInternalProviderSql(
      "resource_sample", loadSealedSampleArtifact("resource"),
    ),
    parser: (stdout) => parseFinalResourceOutput(stdout, handoff.resourceBaseline),
  })
  if (resource.status === "failure") {
    return { status: "failed", reason: "final_resource_failed" }
  }
  const reasons = evaluateDryRunThresholds(
    fast.value, handoff.workBaseline, resource.value,
  ).filter((reason) => reason !== "guard_inactive")
  if (resource.value.observedAtUtcMs < fast.value.observedAtUtcMs || reasons.length > 0) {
    return { status: "failed", reason: "final_threshold_failed" }
  }
  try {
    await dependencies.appendReceipt(handoff.receipt, {
      event_type: "resource_sample",
      timestamp_utc: new Date(resource.value.observedAtUtcMs).toISOString(),
      metrics: {
        sample_kind: "resource", status: "passed",
        resources: {
          database_bytes: handoff.resourceBaseline.databaseBytes +
            resource.value.databaseGrowthBytes,
          cron_history_bytes: handoff.resourceBaseline.cronHistoryBytes +
            resource.value.cronHistoryGrowthBytes,
          wal_directory_bytes: resource.value.walDirectoryBytes,
          deadlocks: handoff.resourceBaseline.deadlocks + resource.value.deadlockDelta,
          numbackends: resource.value.databaseBackends,
          waiting_locks: resource.value.waitingLocks,
        },
      },
    })
  } catch {
    return { status: "failed", reason: "receipt_failure" }
  }
  return { status: "passed", fast: fast.value, resource: resource.value }
}
