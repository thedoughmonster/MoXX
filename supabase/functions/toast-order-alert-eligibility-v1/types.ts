export type ClaimOutcome = {
  event_found: boolean
  matched_count: number
  ambiguous_count: number
  claimed_count: number
  candidate_ids: string[]
}
