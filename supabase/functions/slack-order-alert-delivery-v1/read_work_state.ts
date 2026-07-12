import { sql } from "./database.ts"
import type { WorkState } from "./types.ts"

export async function readWorkState(
  workId: string,
  triggerToken: string,
): Promise<WorkState> {
  const rows = await sql<WorkState[]>`
    select
      case when work.status = 'succeeded'
        then 'already_succeeded'
        else 'unavailable'
      end as disposition,
      work.id::text as work_id,
      latest.id::text as attempt_id,
      latest.invocation_id::text,
      latest.slack_channel_id as channel,
      latest.slack_message_ts as ts
    from toast_alerting.slack_delivery_work as work
    left join lateral (
      select
        attempt.id,
        attempt.invocation_id,
        attempt.slack_channel_id,
        attempt.slack_message_ts
      from toast_alerting.slack_delivery_attempts as attempt
      where attempt.work_id = work.id
      order by attempt.id desc
      limit 1
    ) as latest on true
    where work.id = ${workId}::bigint
      and work.trigger_token = ${triggerToken}::uuid
  `

  return rows[0] ?? { disposition: "not_found", work_id: workId }
}
