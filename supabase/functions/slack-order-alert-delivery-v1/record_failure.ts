import { sql } from "./database.ts"
import type { ClaimedWork, FailureRecord } from "./types.ts"

export async function recordFailure(
  work: ClaimedWork,
  failure: FailureRecord,
): Promise<void> {
  const rows = await sql<{ work_id: string }[]>`
    with target_work as (
      select work.id
      from toast_alerting.slack_delivery_work as work
      where work.id = ${work.work_id}::bigint
        and work.status = 'running'
      for update
    ), attempt_update as (
      update toast_alerting.slack_delivery_attempts as attempt
      set finished_at = now(),
          outcome = 'failed',
          http_status = ${failure.http_status},
          slack_channel_id = ${failure.channel},
          slack_message_ts = ${failure.ts},
          response_metadata = ${sql.json(failure.response_metadata)},
          error_code = ${failure.error_code},
          error_message = ${failure.error_message}
      from target_work
      where attempt.id = ${work.attempt_id}::bigint
        and attempt.work_id = target_work.id
        and attempt.outcome = 'running'
      returning attempt.work_id
    )
    update toast_alerting.slack_delivery_work as delivery_work
    set status = 'failed',
        lease_expires_at = null,
        last_error = ${failure.error_message},
        last_outcome = jsonb_build_object(
          'attempt_id', ${work.attempt_id}::text,
          'invocation_id', ${work.invocation_id}::text,
          'outcome', 'failed',
          'http_status', ${failure.http_status}::integer,
          'error_code', ${failure.error_code}::text
        )
    from attempt_update
    where delivery_work.id = attempt_update.work_id
    returning delivery_work.id::text as work_id
  `

  if (rows.length !== 1) {
    throw new Error("Slack delivery failure was not persisted")
  }
}
