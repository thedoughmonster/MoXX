import type { JSONValue } from "postgres"

export const functionKey = "momi.slack.order_alert.deliver.v1"

export type DeliveryTriggerInput = {
  work_id: string
  trigger_token: string
}

export type SlackMessagePayload = Record<string, unknown>

export type ClaimedWork = {
  disposition: "claimed"
  work_id: string
  candidate_id: string
  attempt_id: string
  invocation_id: string
}

export type WorkState = {
  disposition: "already_succeeded"
  work_id: string
  attempt_id?: string | null
  invocation_id?: string | null
  channel?: string | null
  ts?: string | null
} | {
  disposition: "unavailable"
  work_id: string
} | {
  disposition: "not_found"
  work_id: string
}

export type ClaimWorkResult = ClaimedWork | WorkState

export type PreparedMessage = {
  delivery_work_id: string
  candidate_id: string
  destination_key: string
  destination_enabled: boolean
  slack_channel_id: string
  message_payload: SlackMessagePayload
}

export type ParsedSlackBody = {
  body: JSONValue
  is_json: boolean
}

export type SlackTransportResult = ParsedSlackBody & {
  status: number
  response_headers: Record<string, string>
}

export type SlackResponseSummary = {
  channel: string | null
  ts: string | null
  slack_error: string | null
  response_metadata: JSONValue
}

export type FailureRecord = {
  http_status: number | null
  channel: string | null
  ts: string | null
  response_metadata: JSONValue
  error_code: string
  error_message: string
}

export type ExecutionResult = {
  status: number
  body: Record<string, unknown>
}
