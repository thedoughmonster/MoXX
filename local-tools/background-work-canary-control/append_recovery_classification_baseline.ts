import { appendReceipt } from "./append_receipt.ts"
import type { RecoverySnapshot, RecoveryState } from "./recovery_types.ts"

export async function appendRecoveryClassificationBaseline(
  state: RecoveryState, sample: RecoverySnapshot,
): Promise<void> {
  await appendReceipt(state.receipt, { event_type: "work_baseline",
    timestamp_utc: new Date(sample.observedAtUtcMs).toISOString(), metrics: {
      status: "accepted_classification", registry_count: sample.registryCount,
      registry_sha256: sample.registrySha256, schedule_due_sha256: sample.scheduleDueSha256,
      routing_catalog_count: sample.routingCatalogCount,
      routing_catalog_sha256: sample.routingCatalogSha256,
      toast_sha256: sample.toastSha256,
      cohort_boundary_sha256: sample.cohortBoundarySha256,
      cohort_root_count: sample.cohortRootCount,
      cohort_root_sha256: sample.cohortRootSha256,
      cohort_membership_count: sample.cohortMembershipCount,
      cohort_membership_sha256: sample.cohortMembershipSha256,
      cohort_lineage_edge_count: sample.cohortLineageEdgeCount,
      cohort_lineage_edge_sha256: sample.cohortLineageEdgeSha256,
      queues: { toast_ready: sample.toastReady, routing_ready: sample.routingReady,
        delivery_ready: sample.deliveryReady, queue_ready: sample.queueReady },
      resources: { numbackends: sample.databaseBackends,
        wal_directory_bytes: sample.walDirectoryBytes,
        waiting_locks: sample.waitingLocks },
    } })
}
