import { appendReceipt } from "./append_receipt.ts"
import type { RecoveryState } from "./recovery_types.ts"
import { runRecoveryActivation } from "./run_recovery_activation.ts"
import { runRecoveryBootstrap } from "./run_recovery_bootstrap.ts"
import { runRecoveryPreflight } from "./run_recovery_preflight.ts"

export async function startRecoveryCanary(state: RecoveryState): Promise<void> {
  await appendReceipt(state.receipt, { event_type: "run_started",
    timestamp_utc: new Date().toISOString(), metrics: {
      project_ref: state.runtime.options.projectRef, status: "started" } })
  const preflight = await runRecoveryPreflight(state)
  state.preflight = preflight
  await appendReceipt(state.receipt, { event_type: "work_baseline",
    timestamp_utc: new Date(preflight.observedAtUtcMs).toISOString(), metrics: {
      status: "classified", registry_count: preflight.registryCount,
      registry_sha256: preflight.registrySha256, toast_sha256: preflight.toastSha256,
      schedule_due_sha256: preflight.scheduleDueSha256,
      queues: { toast_ready: preflight.toastReady, routing_ready: preflight.routingReady,
        delivery_ready: preflight.deliveryReady, queue_ready: preflight.queueReady },
      resources: { database_bytes: preflight.databaseBytes,
        cron_history_bytes: preflight.cronHistoryBytes,
        wal_directory_bytes: preflight.walDirectoryBytes,
        numbackends: preflight.databaseBackends } } })
  await runRecoveryBootstrap(state, preflight.maxCronRunId)
  await appendReceipt(state.receipt, { event_type: "guard_heartbeat",
    timestamp_utc: new Date(Date.parse(state.guard!.expiryUtc) - 30_000).toISOString(),
    metrics: { status: "active", guard: { active: true,
      job_id: state.guard!.guardJobId, job_name: state.guard!.guardName,
      schedule: state.guard!.guardSchedule,
      generation_sha256: state.guard!.generationSha256,
      command_md5: state.guard!.commandMd5 } } })
  const activation = await runRecoveryActivation(state)
  await appendReceipt(state.receipt, { event_type: "activation_completed",
    timestamp_utc: new Date(activation.startedAtUtcMs).toISOString(), metrics: {
      status: "active", generation_sha256: activation.generationSha256,
      registry_count: activation.frozen.registryCount,
      registry_sha256: activation.frozen.registrySha256,
      schedule_due_sha256: activation.frozen.scheduleDueSha256,
      toast_sha256: activation.frozen.toastSha256,
      target: { active_before_mask: 0, active_after_mask: 11,
        exact_identity_mask: 15 },
      queues: { toast_ready: activation.frozen.toastReady,
        routing_ready: activation.frozen.routingReady,
        delivery_ready: activation.frozen.deliveryReady,
        queue_ready: activation.frozen.queueReady } } })
}
