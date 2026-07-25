import type { JSONValue } from "postgres"

export type CallerKey = "communications-gateway" |
  "communications-evaluation" | "github-issue-triage"

export type CreateRequest = {
  schema_version: 1
  operation: "create"
  purpose_key: string
  profile_key: string
  parent_invocation_id: string
  idempotency_key: string
  deadline_at: string
  requested_output_tokens: number
  background: boolean
  payload: Record<string, JSONValue>
}

export type RetrieveRequest = {
  schema_version: 1
  operation: "retrieve"
  call_id: string
  provider_response_id: string
  deadline_at: string
}

export type ExecutionRequest = CreateRequest | RetrieveRequest

export type Admission = {
  disposition: "admitted" | "duplicate"
  call_id: string
  status: string
  provider_endpoint: string
  provider_model: string
  reasoning_effort: string
  maximum_output_tokens: number
  timeout_seconds: number
  x_client_request_id: string
  provider_response_id: string | null
  input_micros_per_token: string
  output_micros_per_token: string
}

export type ProviderConfig = {
  call_id: string
  provider_endpoint: string
  provider_model: string
  timeout_seconds: number
  x_client_request_id: string
  input_micros_per_token: string
  output_micros_per_token: string
}

export type Usage = {
  input_tokens: number | null
  cached_input_tokens: number | null
  output_tokens: number | null
  reasoning_tokens: number | null
  billed_cost_micros: number | null
}

export type ProviderResult = Usage & {
  ok: boolean
  ambiguous: boolean
  status: number
  body: Record<string, JSONValue>
  duration_ms: number
  provider_request_id: string | null
  provider_response_id: string | null
  error_category: string | null
  started_at: string
  method: "POST" | "GET"
  request_path: string
}
