import { sql } from "./database.ts"
import type { ClaimedJob } from "./types.ts"

export async function recordFailure(
  job: ClaimedJob,
  errorCode: string,
  errorMessage: string,
  httpStatus: number | null,
  responseHeaders: Record<string, string>,
  sourceErrorBody: unknown,
): Promise<void> {
  await sql`
    with attempt_update as (
      update toast_hydration.order_hydration_attempts
      set finished_at = now(),
          outcome = 'failed',
          http_status = ${httpStatus},
          response_headers = ${sql.json(responseHeaders)},
          source_error_body = ${sql.json(sourceErrorBody)},
          error_code = ${errorCode},
          error_message = ${errorMessage}
      where id = ${job.attempt_id}::bigint
      returning job_id
    )
    update toast_hydration.order_hydration_jobs as hydration_job
    set status = 'failed',
        lease_expires_at = null,
        last_error = ${errorMessage}
    from attempt_update
    where hydration_job.id = attempt_update.job_id
  `
}
