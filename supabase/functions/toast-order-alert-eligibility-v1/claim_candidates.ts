import { sql } from "./database.ts"
import type { ClaimOutcome } from "./types.ts"

export async function claimCandidates(rawEventId: string): Promise<ClaimOutcome> {
  const rows = await sql`
    select
      event_found,
      matched_count,
      ambiguous_count,
      claimed_count,
      candidate_ids
    from toast_alerting.claim_order_alert_candidates(${rawEventId}::bigint)
  `
  const outcome = rows[0] as ClaimOutcome | undefined

  if (!outcome) {
    throw new Error("eligibility claim returned no outcome")
  }

  return outcome
}
