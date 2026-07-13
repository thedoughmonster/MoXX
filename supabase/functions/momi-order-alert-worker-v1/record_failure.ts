import { sql } from "./database.ts"
import type { ClaimedWork } from "./types.ts"

export async function recordFailure(
  job: ClaimedWork,
  httpStatus: number | null,
  errorCode: string,
  errorMessage: string,
  responseMetadata: Record<string, unknown>,
): Promise<void> {
  await sql`
    with attempt_update as (
      update momi_orders.api_invocation_attempts
      set finished_at = now(),
          outcome = 'failed',
          http_status = ${httpStatus}::integer,
          response_metadata = ${sql.json(responseMetadata)},
          error_code = ${errorCode},
          error_message = ${errorMessage}
      where id = ${job.attempt_id}::bigint
      returning work_id
    )
    update momi_orders.api_invocation_work as work
    set status = 'failed',
        lease_expires_at = null,
        last_error = ${errorMessage},
        last_outcome = jsonb_build_object(
          'error_code', ${errorCode},
          'http_status', ${httpStatus}::integer
        )
    from attempt_update
    where work.id = attempt_update.work_id
  `
}
