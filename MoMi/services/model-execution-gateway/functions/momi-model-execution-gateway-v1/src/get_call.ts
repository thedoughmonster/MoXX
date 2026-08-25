import { getDatabase } from "./database.ts"
import type { CallerKey } from "./types.ts"

export async function getCall(callId: string): Promise<{
  caller_key: CallerKey
  purpose_key: string
  profile_key: string
  status: string
  provider_response_id: string | null
  x_client_request_id: string
  provider_endpoint: string
  provider_model: string
  timeout_seconds: number
  input_micros_per_token: string
  output_micros_per_token: string
} | null> {
  const sql = getDatabase()
  const rows = await sql<{
    caller_key: CallerKey; purpose_key: string; profile_key: string
    status: string; provider_response_id: string | null; x_client_request_id: string
    provider_endpoint: string; provider_model: string; timeout_seconds: number
    input_micros_per_token: string; output_micros_per_token: string
  }[]>`select * from momi_model_execution.get_call_v1(${callId}::uuid)`
  return rows[0] ?? null
}
