import {
  buildRecoveryClassificationCohortEvidence,
} from "./build_recovery_classification_cohort_evidence.ts"
import {
  buildRecoveryClassificationControlEvidence,
} from "./build_recovery_classification_control_evidence.ts"
import type { ReceiptVerification } from "./receipt_types.ts"
import type { RecoveryClassificationTiming } from "./recovery_classification_types.ts"
import type { RecoverySnapshot, RecoveryState } from "./recovery_types.ts"

export function buildRecoveryClassificationArtifact(
  state: RecoveryState, sample: RecoverySnapshot, timing: RecoveryClassificationTiming,
  receipt: ReceiptVerification,
): unknown {
  const runtime = state.runtime
  const setup = runtime.setupReceipt
  const querySha256 = state.preflightQuerySha256!
  const queryTiming = state.preflightTiming!
  return { schema_version: 1, run_id: state.runId, mode: "classification_only",
    terminal_reason_code: "accepted_classification", disposition: "accepted",
    environment: runtime.options.environment, project_ref: runtime.options.projectRef,
    release: { sha: runtime.repository.headSha,
      tree_sha: state.classificationReleaseTreeSha },
    setup_claim: { disposition: "claimed_once", receipt_sha256: setup.receiptSha256,
      integrity_sha256: setup.integritySha256, release_sha: setup.releaseSha,
      project_identity_sha256: setup.projectIdentitySha256,
      setup_query_identity_sha256: setup.queryIdentitySha256,
      original_status: setup.status, original_stage: setup.stage,
      hosted_mutation_possible: setup.hostedMutationPossible },
    query: { sha256: querySha256, count: 1, result: "accepted",
      provider_query_read_only: true, final_control_from_same_query: true,
      started_at_utc: new Date(queryTiming.startedAtUtcMs).toISOString(),
      ended_at_utc: new Date(queryTiming.endedAtUtcMs).toISOString(),
      duration_ms: queryTiming.durationMs },
    timing: { started_at_utc: new Date(timing.startedAtUtcMs).toISOString(),
      ended_at_utc: new Date(timing.endedAtUtcMs).toISOString(),
      duration_ms: timing.durationMs },
    invariant_groups: { accepted: { work: true, control: true, cohort: true,
      routes: true, safety: true }, rejected: { work: false, control: false,
      cohort: false, routes: false, safety: false } },
    work_evidence: { toast_open: sample.toastOpen, toast_ready: sample.toastReady,
      toast_running: sample.toastRunning, toast_retry: sample.toastRetry,
      toast_dead: sample.toastDead, toast_future: sample.toastFuture,
      toast_attempted: sample.toastAttempted, toast_unexpected: sample.toastUnexpected,
      toast_partial: sample.toastPartial, toast_unmatched: sample.toastUnmatched,
      toast_sha256: sample.toastSha256, routing_open: sample.routingOpen,
      routing_ready: sample.routingReady, routing_running: sample.routingRunning,
      routing_retry: sample.routingRetry, routing_dead: sample.routingDead,
      routing_invalid: sample.routingInvalid, delivery_open: sample.deliveryOpen,
      delivery_ready: sample.deliveryReady, delivery_running: sample.deliveryRunning,
      delivery_retry: sample.deliveryRetry, delivery_dead: sample.deliveryDead,
      delivery_invalid: sample.deliveryInvalid, queue_ready: sample.queueReady },
    control_evidence: buildRecoveryClassificationControlEvidence(sample, querySha256),
    cohort_evidence: buildRecoveryClassificationCohortEvidence(sample),
    contract_evidence: { registry_count: sample.registryCount,
      registry_contract_violations: sample.registryContractViolations,
      registry_sha256: sample.registrySha256,
      schedule_due_sha256: sample.scheduleDueSha256,
      due_schedule_count: sample.dueScheduleCount,
      routing_catalog_count: sample.routingCatalogCount,
      routing_catalog_sha256: sample.routingCatalogSha256,
      active_toast_route_count: sample.activeToastRouteCount,
      active_routing_route_count: sample.activeRoutingRouteCount,
      active_projection_edge_route_count: sample.activeProjectionEdgeRouteCount,
      database_projection_mode_count: sample.databaseProjectionModeCount,
      active_projection_subscription_count: sample.activeProjectionSubscriptionCount,
      route_contract_violations: sample.routeContractViolations },
    safety_evidence: { queue_dead: sample.queueDead, open_attempts: sample.openAttempts,
      projection_reservations: sample.projectionReservations,
      expired_leases: sample.expiredLeases, long_leases: sample.longLeases,
      worker_cap_violations: sample.workerCapViolations,
      database_bytes: sample.databaseBytes, cron_history_bytes: sample.cronHistoryBytes,
      wal_directory_bytes: sample.walDirectoryBytes, deadlocks: sample.deadlocks,
      database_backends: sample.databaseBackends, max_connections: sample.maxConnections,
      reserved_connections: sample.reservedConnections,
      available_nonreserved_connections: sample.maxConnections -
        sample.reservedConnections - sample.databaseBackends },
    receipt_chain: { terminal_event: "run_completed", terminal_sequence: receipt.count,
      terminal_sha256: receipt.lastHash },
    effects: { provider_query_read_only: true, provider_mutation_possible: false,
      guard_created: false, targets_activated: false, cron_mutated: false,
      queue_or_durable_work_mutated: false, production_accessed: false,
      cleanup_performed: false } }
}
