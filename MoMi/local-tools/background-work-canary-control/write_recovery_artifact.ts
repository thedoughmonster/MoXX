import { open, readFile } from "node:fs/promises"
import { join } from "node:path"

import { canonicalJson } from "./canonical_json.ts"
import { movePrivateFileExclusive } from "./move_private_file_exclusive.ts"
import type { ReceiptVerification } from "./receipt_types.ts"
import type { RecoveryDisposition, RecoverySnapshot,
  RecoveryState } from "./recovery_types.ts"
import { sha256Text } from "./sha256_text.ts"
import { syncDirectory } from "./sync_directory.ts"

export async function writeRecoveryArtifact(
  state: RecoveryState, disposition: RecoveryDisposition,
  final: RecoverySnapshot, receipt: ReceiptVerification, endedAtUtcMs: number,
  beforePublish?: () => void,
): Promise<{ path: string; sha256: string }> {
  const baseline = state.activation?.frozen ?? state.preflight
  if (!baseline) throw new Error("Recovery baseline evidence is absent")
  const path = join(state.receipt.directory, "recovery-final.json")
  const temporary = join(state.receipt.directory, ".recovery-final.json.tmp")
  const body = canonicalJson({ schema_version: 2, run_id: state.runId,
    project_ref: state.runtime.options.projectRef,
    release_sha: state.runtime.repository.headSha,
    disposition, started_at_utc: new Date(state.activation?.startedAtUtcMs ??
      baseline.observedAtUtcMs).toISOString(),
    ended_at_utc: new Date(endedAtUtcMs).toISOString(),
    schedule_registry: { count: baseline.registryCount, sha256: baseline.registrySha256,
      due_sha256: baseline.scheduleDueSha256,
      contract_violations: baseline.registryContractViolations },
    routing_catalog: { count: baseline.routingCatalogCount,
      sha256: baseline.routingCatalogSha256 },
    preactivation_work: { toast_count: baseline.toastOpen,
      toast_sha256: baseline.toastSha256, routing_count: baseline.routingOpen,
      delivery_count: baseline.deliveryOpen, queue_count: baseline.queueReady,
      due_schedule_count: baseline.dueScheduleCount },
    immutable_cohort: {
      started_at_utc: new Date(baseline.cohortStartedAtUtcMs).toISOString(),
      job_high_water: baseline.jobHighWater,
      observation_high_water: baseline.observationHighWater,
      due_occurrence_count: baseline.dueOccurrences.length,
      boundary_sha256: baseline.cohortBoundarySha256,
      root_count: baseline.cohortRootCount,
      root_sha256: baseline.cohortRootSha256,
      toast_root_count: baseline.toastRootCount,
      toast_root_sha256: baseline.toastRootSha256,
      routing_root_count: baseline.routingRootCount,
      routing_root_sha256: baseline.routingRootSha256,
      delivery_root_count: baseline.deliveryRootCount,
      delivery_root_sha256: baseline.deliveryRootSha256,
      queue_mapping_count: baseline.queueMappingCount,
      queue_mapping_sha256: baseline.queueMappingSha256,
      initial_membership_count: baseline.cohortMembershipCount,
      initial_membership_sha256: baseline.cohortMembershipSha256,
      final_membership_count: final.cohortMembershipCount,
      final_membership_sha256: final.cohortMembershipSha256,
      prior_membership_count: final.priorCohortMembershipCount,
      prior_membership_sha256: final.priorCohortMembershipSha256,
      membership_addition_count: final.cohortMembershipAdditionCount,
      membership_addition_sha256: final.cohortMembershipAdditionSha256,
      removed_member_count: final.cohortMissingPriorMemberCount,
      removed_member_sha256: final.cohortMissingPriorMemberSha256,
      missing_lineage_edge_count: final.cohortMissingPriorLineageEdgeCount,
      missing_lineage_edge_sha256: final.cohortMissingPriorLineageEdgeSha256,
      changed_parent_count: final.cohortChangedParentCount,
      changed_parent_sha256: final.cohortChangedParentSha256,
      final_lineage_edge_count: final.cohortLineageEdgeCount,
      final_lineage_edge_sha256: final.cohortLineageEdgeSha256,
    },
    sampling: { fast_count: state.fastSamples, resource_count: state.resourceSamples,
      consecutive_zero_count: state.zeroSamples, stop_reason: state.stopReason ?? null },
    statement_outcomes: { guard_bootstrap: "verified", activation: "verified",
      activation_target_active_mask: 11, final_target_active_mask: 0,
      recovery_path: state.recoveryPath ?? null, cleanup: "verified",
      final_readback: "verified" },
    final_control: { target_2_active: final.targetJobs[0]?.active ?? null,
      target_3_active: final.targetJobs[1]?.active ?? null,
      target_4_active: final.targetJobs[2]?.active ?? null,
      target_11_active: final.targetJobs[3]?.active ?? null,
      guard_identity_count: final.guardIdentityCount, waiting_locks: final.waitingLocks },
    final_cohort: { job_open: final.cohortJobOpen,
      attempt_open: final.cohortAttemptOpen, routing_open: final.cohortRoutingOpen,
      delivery_open: final.cohortDeliveryOpen, queue_open: final.cohortQueueOpen,
      reservation_open: final.cohortReservationOpen,
      emittable_parents: final.cohortEmittableParents,
      dead: final.cohortDead, retry: final.cohortRetry,
      invalid: final.cohortInvalid, ambiguous: final.cohortAmbiguous,
      terminal_count: final.cohortTerminalCount },
    final_global_safety: { toast_open: final.toastOpen,
      routing_open: final.routingOpen, delivery_open: final.deliveryOpen,
      queue_ready: final.queueReady, open_attempts: final.openAttempts,
      projection_reservations: final.projectionReservations,
      queue_dead: final.queueDead, expired_leases: final.expiredLeases,
      long_leases: final.longLeases },
    receipt_chain: { record_count: receipt.count, last_hash: receipt.lastHash },
    effects: { environment: "development", production_accessed: false,
      durable_work_deleted: false, cron_history_deleted: false,
      unrelated_cleanup_performed: false },
  }) + "\n"
  if (Buffer.byteLength(body, "utf8") > 64 * 1024) throw new Error("Recovery artifact is too large")
  const handle = await open(temporary, "wx", 0o600)
  let identity
  try {
    await handle.chmod(0o600); await handle.writeFile(body, "utf8"); await handle.sync()
    identity = await handle.stat()
  } finally { await handle.close() }
  await syncDirectory(state.receipt.directory)
  beforePublish?.()
  await movePrivateFileExclusive(temporary, path, state.receipt.directory, identity)
  const persisted = await readFile(path, "utf8")
  if (persisted !== body) throw new Error("Recovery artifact changed during publication")
  return { path, sha256: sha256Text(persisted) }
}
