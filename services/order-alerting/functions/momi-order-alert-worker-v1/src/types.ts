import type { JSONValue } from "postgres"
import type { ExactOrderPresentation,
  TransitionalOrderPresentation } from "./order_presentation_types.ts"

export type { ExactOrderPresentation, FulfillmentTiming, OrderPresentation,
  TransitionalOrderPresentation } from "./order_presentation_types.ts"

export const functionKey = "momi.orders.alert.evaluate.v1"
export const exactOrderContractKey = "momi.orders.get_by_version.v1"
export const latestOrderContractKey = "momi.orders.get_by_id.v1"
export const legacyOrderContractKey = "momi.toast_orders.get_by_id.v1"
export type CanonicalOrderContractKey = typeof exactOrderContractKey |
  typeof latestOrderContractKey
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
  location_id: string | null
  order_id: string
  api_contract_key: string
  api_contract_version: number
  api_route_path: string
  trigger_token: string
}

export type CanonicalReadCapability = {
  contract_key: CanonicalOrderContractKey
  work_id: string
  capability_token: string
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
  contract_key: typeof legacyOrderContractKey
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
  order_presentation: TransitionalOrderPresentation
}

export type LatestOrderApiSuccess = {
  ok: true
  contract_key: typeof latestOrderContractKey
  contract_version: number
  trace_id: string
  work_id: string
  order_id: string
  schema_version: number
  order_document: Record<string, JSONValue>
  order_presentation: TransitionalOrderPresentation
  provenance: Record<string, JSONValue>
  freshness: Record<string, JSONValue>
}

export type ExactOrderApiSuccess = {
  ok: true
  contract_key: typeof exactOrderContractKey
  contract_version: number
  trace_id: string
  work_id: string
  order_id: string
  order_version_id: string
  schema_version: 2
  order_document: Record<string, JSONValue>
  order_presentation: ExactOrderPresentation
  provenance: Record<string, JSONValue>
  freshness: Record<string, JSONValue>
}

export type ValidatedOrderResponse =
  | OrderApiSuccess
  | LatestOrderApiSuccess
  | ExactOrderApiSuccess

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
