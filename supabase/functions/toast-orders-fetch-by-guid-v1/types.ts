import type { JSONValue } from "postgres"

export const functionKey = "toast.orders.fetch_by_guid.v1"

export type HydrationTriggerInput = {
  job_id: string
  trigger_token: string
}

export type ClaimedJob = {
  disposition: "claimed"
  job_id: string
  attempt_id: string
  invocation_id: string
  source_key: string
  function_key: string
  restaurant_guid: string
  order_guid: string
  requested_source_version: string
  downstream_api_contract_key: string
  api_base_url: string
  client_id_secret_name: string
  client_secret_secret_name: string
  user_access_type: string
  request_timeout_ms: number
}

type AlreadySucceededJob = {
  disposition: "already_succeeded"
  job_id: string
  attempt_id?: string
  invocation_id?: string
  order_version_id?: string
}

type UnavailableJob = {
  disposition: "unavailable"
  job_id: string
}

type MissingJob = {
  disposition: "not_found"
  job_id: string
}

export type ClaimJobResult =
  | ClaimedJob
  | AlreadySucceededJob
  | UnavailableJob
  | MissingJob

export type ToastAuthResult = {
  ok: boolean
  status: number | null
  token_type?: string
  access_token?: string
  body: JSONValue
}

export type ToastAuthConfig = {
  api_base_url: string
  client_id: string
  client_secret: string
  user_access_type: string
  request_timeout_ms: number
}

export type ToastOrderRequest = {
  api_base_url: string
  restaurant_guid: string
  order_guid: string
  token_type: string
  access_token: string
  request_timeout_ms: number
}

export type ToastOrderResponse = {
  status: number
  body: JSONValue
  raw_body: string
  response_headers: Record<string, string>
}

export type ExecutionResult = {
  status: number
  body: Record<string, unknown>
}

export type PersistedOrder = {
  order_version_id: string
  was_inserted: boolean
}
