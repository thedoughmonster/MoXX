import { sql } from "./database.ts"
import { functionKey, orderApiFunctionKey } from "./types.ts"
import type { WorkClaim, WorkTriggerInput } from "./types.ts"

export async function claimWork(
  input: WorkTriggerInput,
  codeCommitSha: string,
  deploymentId: string | null,
): Promise<WorkClaim> {
  const rows = await sql<WorkClaim[]>`
    with target as (
      select work.*,
        coalesce(registry.active, false) as worker_active
      from toast_hydration.order_api_invocation_work as work
      left join toast_hydration.function_registry as registry
        on registry.function_key = ${functionKey}
      where work.id = ${input.work_id}::bigint
        and work.trigger_token = ${input.trigger_token}::uuid
        and work.api_contract_key = ${orderApiFunctionKey}
      for update of work
    ), claimed as (
      update toast_hydration.order_api_invocation_work as work
      set status = 'running',
          attempt_count = work.attempt_count + 1,
          started_at = coalesce(work.started_at, now()),
          last_attempt_at = now(),
          lease_expires_at = now() + interval '3 minutes',
          last_error = null
      from target
      where work.id = target.id
        and target.worker_active
        and (
          (target.status in ('pending', 'failed')
            and target.not_before <= now())
          or (target.status = 'running'
            and target.lease_expires_at <= now())
        )
      returning work.*
    ), attempt as (
      insert into toast_hydration.order_api_invocation_attempts (
        work_id, code_commit_sha, deployment_id
      )
      select id, ${codeCommitSha}, ${deploymentId}
      from claimed
      returning id, work_id, invocation_id
    )
    select
      case
        when not exists (select 1 from target) then 'not_found'
        when (select status from target) = 'succeeded'
          then 'already_succeeded'
        when exists (select 1 from claimed) then 'claimed'
        else 'unavailable'
      end as disposition,
      ${input.work_id} as work_id,
      (select id::text from attempt) as attempt_id,
      (select invocation_id::text from attempt) as invocation_id,
      (select order_guid from claimed) as order_guid,
      (select order_version_id::text from claimed) as order_version_id,
      (select api_contract_key from claimed) as api_contract_key,
      ${input.trigger_token} as trigger_token
  `
  return rows[0]
}
