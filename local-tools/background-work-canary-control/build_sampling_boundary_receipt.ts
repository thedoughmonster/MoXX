import type { ReceiptInput } from "./receipt_types.ts"
import type { SampleBoundary } from "./schedule_types.ts"
import type { CombinedHeartbeatParseResult } from "./combined_heartbeat_types.ts"
import type { ResourceBaseline } from "./query_payload_types.ts"

export function buildSamplingBoundaryReceipt(
  boundary: SampleBoundary,
  result: CombinedHeartbeatParseResult,
  resourceBaseline: ResourceBaseline,
  durationMs: number,
): ReceiptInput {
  const resource = result.resource
  return {
    event_type: boundary.resource ? "resource_sample" : "fast_sample",
    timestamp_utc: new Date(result.heartbeat.observedAtUtcMs).toISOString(),
    metrics: {
      sample_kind: boundary.resource ? "resource" : "fast",
      status: result.stopReasons.length === 0 ? "passed" : "stopped",
      guard: {
        active: true, job_id: result.heartbeat.guardJobId,
        generation_sha256: result.heartbeat.nextGenerationSha256,
        command_md5: result.heartbeat.commandMd5,
        guard_failures: result.fast.guardFailures,
      },
      target: {
        active: false, target_run_count: result.fast.targetExecutions,
        target_run_failures: result.fast.targetFailures,
        active_cron_executions: result.fast.activeCronExecutions,
      },
      queues: {
        toast_ready: result.fast.toastReady, routing_ready: result.fast.routingReady,
        delivery_ready: result.fast.deliveryReady, queue_ready: result.fast.queueReady,
        waiting_locks: result.fast.waitingLocks,
      },
      resources: resource ? {
        database_bytes: resourceBaseline.databaseBytes + resource.databaseGrowthBytes,
        cron_history_bytes: resourceBaseline.cronHistoryBytes +
          resource.cronHistoryGrowthBytes,
        wal_directory_bytes: resource.walDirectoryBytes,
        deadlocks: resourceBaseline.deadlocks + resource.deadlockDelta,
        numbackends: resource.databaseBackends,
      } : {},
      timing: {
        duration_ms: durationMs,
        missed_samples: result.fast.missedSamples,
        overlap_count: result.fast.overlappingSamples,
      },
    },
  }
}
