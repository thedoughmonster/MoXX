export type DispatchOutcome = {
  event_found: boolean
  matched_count: number
  ambiguous_count: number
  claimed_count: number
  candidate_ids: string[]
  was_already_completed: boolean
}
