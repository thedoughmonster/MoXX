import { sql } from "./database.ts"
import type { DispatchOutcome } from "./types.ts"

export async function processDispatch(
  rawEventId: string,
): Promise<DispatchOutcome> {
  const rows = await sql`
    select
      event_found,
      matched_count,
      ambiguous_count,
      claimed_count,
      candidate_ids,
      was_already_completed
    from toast_alerting.process_order_alert_dispatch(${rawEventId}::bigint)
  `
  const outcome = rows[0] as DispatchOutcome | undefined

  if (!outcome) {
    throw new Error("eligibility dispatch returned no outcome")
  }

  return outcome
}
