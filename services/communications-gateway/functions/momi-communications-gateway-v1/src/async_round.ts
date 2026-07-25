import type { JSONValue } from "postgres"
import type { RouteKey } from "./types.ts"

export type AsyncRound = {
  async_round_id: string
  lease_token: string
  invocation_id: string
  input_payload: Record<string, JSONValue>
  request_payload: Record<string, JSONValue>
  route_key: RouteKey
  answer_round: number
  provider_round: number
  evidence_order: number
  provider_model: string
  archive_receipt_id: string
  async_deadline: string
  maximum_output_tokens: number
}
