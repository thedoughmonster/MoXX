import { sql } from "./database.ts"
import { readJobState } from "./read_job_state.ts"
import type { ClaimJobResult, ClaimedJob } from "./types.ts"

export async function claimJob(
  jobId: string,
  expectedFunctionKey: string,
  codeCommitSha: string,
  deploymentId: string | null,
): Promise<ClaimJobResult> {
  const claimed = await sql<ClaimedJob[]>`
    with claimed_job as (
      update toast_hydration.order_hydration_jobs as job
      set status = 'running',
          attempt_count = job.attempt_count + 1,
          started_at = now(),
          lease_expires_at = now() + make_interval(
            secs => source.lease_duration_seconds
          ),
          completed_at = null,
          last_error = null
      from toast_hydration.api_sources as source,
           toast_hydration.restaurants as restaurant,
           toast_hydration.function_registry as registered_function
      where job.id = ${jobId}::bigint
        and job.function_key = ${expectedFunctionKey}
        and source.source_key = job.source_key
        and source.is_enabled
        and restaurant.source_key = job.source_key
        and restaurant.restaurant_guid = job.restaurant_guid
        and restaurant.is_enabled
        and registered_function.function_key = job.function_key
        and registered_function.active
        and exists (
          select 1
          from toast_hydration.function_trigger_registry as trigger_record
          where trigger_record.function_key = job.function_key
            and trigger_record.active
        )
        and (
          (job.status in ('pending', 'failed') and job.not_before <= now())
          or (
            job.status = 'running'
            and job.lease_expires_at is not null
            and job.lease_expires_at <= now()
          )
        )
      returning
        job.*,
        source.api_base_url,
        source.client_id_secret_name,
        source.client_secret_secret_name,
        source.user_access_type,
        source.request_timeout_ms
    ), created_attempt as (
      insert into toast_hydration.order_hydration_attempts (
        job_id,
        code_commit_sha,
        deployment_id,
        resolved_input
      )
      select
        job.id,
        ${codeCommitSha},
        ${deploymentId},
        jsonb_build_object(
          'function_key', job.function_key,
          'source_key', job.source_key,
          'restaurant_guid', job.restaurant_guid,
          'order_guid', job.order_guid,
          'requested_source_version', job.requested_source_version,
          'api_base_url', job.api_base_url,
          'client_id_secret_name', job.client_id_secret_name,
          'client_secret_secret_name', job.client_secret_secret_name,
          'user_access_type', job.user_access_type,
          'request_timeout_ms', job.request_timeout_ms
        )
      from claimed_job as job
      returning id, invocation_id, job_id
    )
    select
      'claimed'::text as disposition,
      job.id::text as job_id,
      attempt.id::text as attempt_id,
      attempt.invocation_id::text,
      job.source_key,
      job.function_key,
      job.restaurant_guid,
      job.order_guid,
      job.requested_source_version,
      job.downstream_api_contract_key,
      job.api_base_url,
      job.client_id_secret_name,
      job.client_secret_secret_name,
      job.user_access_type,
      job.request_timeout_ms
    from claimed_job as job
    join created_attempt as attempt on attempt.job_id = job.id
  `

  if (claimed.length === 1) {
    return claimed[0]
  }

  return readJobState(jobId)
}
