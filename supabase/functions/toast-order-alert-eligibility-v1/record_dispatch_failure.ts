import { sql } from "./database.ts"

export async function recordDispatchFailure(rawEventId: string): Promise<void> {
  await sql`
    update toast_alerting.order_alert_dispatches as dispatch
    set attempt_count = dispatch.attempt_count + 1,
        last_attempt_at = now(),
        last_error = 'eligibility processing failed'
    where dispatch.raw_event_id = ${rawEventId}::bigint
      and dispatch.completed_at is null
  `
}
