import { sql } from "./database.ts"
import { canonicalOrderContractKey, functionKey,
  legacyOrderContractKey } from "./types.ts"
import type { WorkClaim, WorkTriggerInput } from "./types.ts"

export async function claimWork(
  input: WorkTriggerInput,
  codeCommitSha: string,
  deploymentId: string | null,
): Promise<WorkClaim> {
  const rows = await sql<WorkClaim[]>`
    with target as (
      select work.*,
        coalesce(worker.active, false) as worker_active,
        coalesce(api.active and api.function_type = 'read', false) as api_active,
        api.contract_version as api_contract_version,
        route.route_count,
        route.route_path as api_route_path
      from momi_orders.api_invocation_work as work
      left join momi_runtime.function_registry as worker
        on worker.function_key = ${functionKey}
      left join momi_runtime.function_registry as api
        on api.function_key = work.api_contract_key
      cross join lateral (
        select count(*)::integer as route_count,
          min(trigger.route_path) as route_path
        from momi_runtime.function_trigger_registry as trigger
        where trigger.function_key = work.api_contract_key
          and trigger.contract_version = api.contract_version
          and trigger.active
          and trigger.trigger_type = 'durable_http'
          and upper(trigger.http_method) = 'POST'
          and (
            (work.api_contract_key = ${canonicalOrderContractKey}
              and trigger.authentication_policy_key =
                'durable.read_capability.v1')
            or (work.api_contract_key = ${legacyOrderContractKey}
              and trigger.authentication_policy_key =
                'durable.work_token.v1')
          )
          and nullif(trigger.route_path, '') is not null
      ) as route
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
        and target.worker_active
        and target.api_active
        and target.route_count = 1
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
