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
  const body = canonicalJson({ schema_version: 1, run_id: state.runId,
    project_ref: state.runtime.options.projectRef,
    release_sha: state.runtime.repository.headSha,
    disposition, started_at_utc: new Date(state.activation?.startedAtUtcMs ??
      baseline.observedAtUtcMs).toISOString(),
    ended_at_utc: new Date(endedAtUtcMs).toISOString(),
    schedule_registry: { count: baseline.registryCount, sha256: baseline.registrySha256,
      due_sha256: baseline.scheduleDueSha256,
      contract_violations: baseline.registryContractViolations },
    preactivation_work: { toast_count: baseline.toastOpen,
      toast_sha256: baseline.toastSha256, routing_count: baseline.routingOpen,
      delivery_count: baseline.deliveryOpen, queue_count: baseline.queueReady,
      due_schedule_count: baseline.dueScheduleCount },
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
    final_work: { toast_open: final.toastOpen, routing_open: final.routingOpen,
      delivery_open: final.deliveryOpen, queue_ready: final.queueReady,
      open_attempts: final.openAttempts, projection_reservations: final.projectionReservations },
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
