import { canonicalJson } from "./canonical_json.ts"
import type { RecoverySnapshot } from "./recovery_types.ts"
import { sha256Text } from "./sha256_text.ts"

export function buildRecoveryClassificationControlEvidence(
  sample: RecoverySnapshot, querySha256: string,
): unknown {
  const identities = sample.targetJobs.map((job) => ({ job_id: job.jobId,
    job_name: job.jobName, schedule: job.schedule, command_md5: job.commandMd5 }))
  const targetActiveMask = sample.targetJobs.reduce((mask, job, index) =>
    mask | (job.active ? 1 << index : 0), 0)
  return { source_query_sha256: querySha256, target_count: sample.targetJobs.length,
    target_identity_sha256: sha256Text(canonicalJson(identities)),
    target_active_mask: targetActiveMask,
    guard_identity_count: sample.guardIdentityCount,
    active_cron_executions: sample.activeCronExecutions,
    waiting_locks: sample.waitingLocks, max_cron_run_id: sample.maxCronRunId,
    lifecycle_lock_held_during_publication: true,
    provider_closed_before_publication: true }
}
