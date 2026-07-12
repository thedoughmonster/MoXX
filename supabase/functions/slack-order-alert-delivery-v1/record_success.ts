import { sql } from "./database.ts"
import type {
  ClaimedWork,
  SlackResponseSummary,
  SlackTransportResult,
} from "./types.ts"

export async function recordSuccess(
  work: ClaimedWork,
  response: SlackTransportResult,
  summary: SlackResponseSummary,
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
          outcome = 'succeeded',
          http_status = ${response.status},
          slack_channel_id = ${summary.channel},
          slack_message_ts = ${summary.ts},
          response_metadata = ${sql.json(summary.response_metadata)},
          error_code = null,
          error_message = null
      from target_work
      where attempt.id = ${work.attempt_id}::bigint
        and attempt.work_id = target_work.id
        and attempt.outcome = 'running'
      returning attempt.work_id
    )
    update toast_alerting.slack_delivery_work as delivery_work
    set status = 'succeeded',
        lease_expires_at = null,
        completed_at = now(),
        last_error = null,
        last_outcome = jsonb_build_object(
          'attempt_id', ${work.attempt_id}::text,
          'invocation_id', ${work.invocation_id}::text,
          'outcome', 'succeeded',
          'http_status', ${response.status}::integer,
          'slack_channel_id', ${summary.channel}::text,
          'slack_message_ts', ${summary.ts}::text
        )
    from attempt_update
    where delivery_work.id = attempt_update.work_id
    returning delivery_work.id::text as work_id
  `

  if (rows.length !== 1) {
    throw new Error("Slack delivery success was not persisted")
  }
}
