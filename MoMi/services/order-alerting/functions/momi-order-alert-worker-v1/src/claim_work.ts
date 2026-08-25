import { sql } from "./database.ts"
import type { WorkClaim, WorkTriggerInput } from "./types.ts"

export async function claimWork(
  input: WorkTriggerInput,
  codeCommitSha: string,
  deploymentId: string | null,
): Promise<WorkClaim> {
  const rows = await sql<WorkClaim[]>`
    with target as (
      select work.*, reader.contract_version as api_contract_version,
        reader.route_path as api_route_path
      from momi_orders.api_invocation_work as work
      cross join lateral
        momi_runtime.resolve_order_alert_worker_trigger_v1() as worker
      cross join lateral
        momi_runtime.resolve_order_alert_reader_trigger_v1(
          work.api_contract_key
        ) as reader
      where work.id = ${input.work_id}::bigint
        and work.trigger_token = ${input.trigger_token}::uuid
      for update of work
    ), claimed as (
      update momi_orders.api_invocation_work as work
      set status = 'running',
          attempt_count = work.attempt_count + 1,
          started_at = coalesce(work.started_at, now()),
          last_attempt_at = now(),
          lease_expires_at = now() + interval '3 minutes',
          last_error = null
      from target
      where work.id = target.id
        and left(target.api_route_path, 1) = '/'
        and left(target.api_route_path, 2) <> '//'
        and (
          (target.status in ('pending', 'failed')
            and target.not_before <= now())
          or (target.status = 'running'
            and target.lease_expires_at <= now())
        )
      returning work.*
    ), claimed_work as (
      select claimed.*,
        target.api_contract_version,
        target.api_route_path
      from claimed
      join target on target.id = claimed.id
    ), attempt as (
      insert into momi_orders.api_invocation_attempts (
        work_id, code_commit_sha, deployment_id
      )
      select id, ${codeCommitSha}, ${deploymentId}
      from claimed_work
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
      (select source_system from claimed_work) as source_system,
      (select source_version_id from claimed_work) as source_version_id,
      (select location_id from claimed_work) as location_id,
      (select order_id from claimed_work) as order_id,
      (select api_contract_key from claimed_work) as api_contract_key,
      (select api_contract_version from claimed_work) as api_contract_version,
      (select api_route_path from claimed_work) as api_route_path,
      ${input.trigger_token} as trigger_token
  `
  return rows[0]
}
