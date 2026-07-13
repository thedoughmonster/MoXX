import type { JSONValue } from "postgres"

export const functionKey = "momi.orders.alert.evaluate.v1"

export type WorkTriggerInput = {
  work_id: string
  trigger_token: string
}

export type ClaimedWork = {
  disposition: "claimed"
  work_id: string
  attempt_id: string
  invocation_id: string
  source_system: string
  source_version_id: string
  location_id: string
  order_id: string
  api_contract_key: string
  api_contract_version: number
  api_route_path: string
  trigger_token: string
}

export type WorkClaim = ClaimedWork | {
  disposition: "already_succeeded"
  work_id: string
} | {
  disposition: "unavailable"
  work_id: string
} | {
  disposition: "not_found"
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
  work_source_version_id: string
  source_system: string
  source_version_id: string
  location_id: string
  order_id: string
  retrieved_at: string
  content_hash: string
  payload: JSONValue
  order_presentation: OrderPresentation
}

export type OrderPresentation = {
  presentation_version: 1
  display_number: string
  fulfillment_at: string | null
  fulfillment_epoch: number | null
  item_count: number
  total_amount: number | null
  items: Array<{
    name: string
    quantity: number
    modifiers: Array<{
      name: string
      quantity: number
      depth: number
    }>
  }>
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
