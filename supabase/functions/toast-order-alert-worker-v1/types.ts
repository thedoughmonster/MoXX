export const functionKey = "toast.orders.alert_from_hydrated_order.v1"
export const orderApiFunctionKey = "momi.orders.get_by_guid.v1"
export const orderApiRoute = "/functions/v1/momi-orders-get-by-guid-v1"

export type WorkTriggerInput = {
  work_id: string
  trigger_token: string
}

export type ClaimedWork = {
  disposition: "claimed"
  work_id: string
  attempt_id: string
  invocation_id: string
  order_guid: string
  order_version_id: string
  api_contract_key: string
  trigger_token: string
}

export type WorkClaim = ClaimedWork | {
  disposition: "already_succeeded" | "unavailable" | "not_found"
  work_id: string
}

export type OrderApiResponse = {
  status: number
  body: unknown
  response_headers: Record<string, string>
}

export type OrderApiSuccess = {
  ok: true
  contract_key: string
  contract_version: number
  trace_id: string
  work_id: string
  work_order_version_id: string
  order_guid: string
  order_version_id: string
  payload: Record<string, unknown>
}

export type DecisionOutcome = {
  work_found: boolean
  order_matches: boolean
  matched_count: number
  ambiguous_count: number
  claimed_count: number
  candidate_ids: string[]
}

export type ExecutionResult = {
  status: number
  body: Record<string, unknown>
}
