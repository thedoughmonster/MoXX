import { sql } from "./database.ts"
import { readWorkState } from "./read_work_state.ts"
import { functionKey } from "./types.ts"
import type { ClaimWorkResult, ClaimedWork } from "./types.ts"

export async function claimWork(
  workId: string,
  triggerToken: string,
  codeCommitSha: string,
  deploymentId: string | null,
): Promise<ClaimWorkResult> {
  const rows = await sql<ClaimedWork[]>`
    with claimed_work as (
      update momi_alerting.slack_delivery_work as work
      set status = 'running',
          attempt_count = work.attempt_count + 1,
          started_at = coalesce(work.started_at, now()),
          lease_expires_at = now() + interval '3 minutes',
          completed_at = null,
          last_error = null
      where work.id = ${workId}::bigint
        and work.trigger_token = ${triggerToken}::uuid
        and exists (
          select 1
          from momi_runtime.function_registry as registry
          where registry.function_key = ${functionKey}
            and registry.active
        )
        and (
          (work.status in ('pending', 'failed') and work.not_before <= now())
          or (
            work.status = 'running'
            and work.lease_expires_at is not null
            and work.lease_expires_at <= now()
          )
        )
      returning work.id, work.candidate_id
    ), created_attempt as (
      insert into momi_alerting.slack_delivery_attempts (
        work_id,
        code_commit_sha,
        deployment_id
      )
      select id, ${codeCommitSha}, ${deploymentId}
      from claimed_work
      returning id, invocation_id, work_id
    )
    select
      'claimed'::text as disposition,
      work.id::text as work_id,
      work.candidate_id::text,
      attempt.id::text as attempt_id,
      attempt.invocation_id::text
    from claimed_work as work
    join created_attempt as attempt on attempt.work_id = work.id
  `

  return rows.length === 1
    ? rows[0]
    : readWorkState(workId, triggerToken)
}
