import { sql } from "./database.ts"
import type { ClaimJobResult } from "./types.ts"

export async function readJobState(jobId: string): Promise<ClaimJobResult> {
  const existing = await sql<ClaimJobResult[]>`
    select
      case when job.status = 'succeeded'
        then 'already_succeeded'
        else 'unavailable'
      end as disposition,
      job.id::text as job_id,
      latest.id::text as attempt_id,
      latest.invocation_id::text,
      latest.order_version_id::text
    from toast_hydration.order_hydration_jobs as job
    left join lateral (
      select attempt.id, attempt.invocation_id, attempt.order_version_id
      from toast_hydration.order_hydration_attempts as attempt
      where attempt.job_id = job.id
      order by attempt.id desc
      limit 1
    ) as latest on true
    where job.id = ${jobId}::bigint
  `

  return existing[0] ?? { disposition: "not_found", job_id: jobId }
}
