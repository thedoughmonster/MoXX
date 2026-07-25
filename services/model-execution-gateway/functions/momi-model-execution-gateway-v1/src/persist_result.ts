import { getDatabase } from "./database.ts"
import { providerStatus } from "./provider_status.ts"
import type { ProviderResult } from "./types.ts"

export async function persistResult(
  callId: string,
  result: ProviderResult,
): Promise<void> {
  const sql = getDatabase()
  const status = providerStatus(result.body, result.ok, result.ambiguous)
  const rows = await sql<{ complete_call_v1: boolean }[]>`
    select momi_model_execution.complete_call_v1(
      ${callId}::uuid, ${status}, ${result.provider_response_id},
      ${result.provider_request_id}, ${result.status}, ${result.duration_ms},
      ${result.input_tokens}, ${result.cached_input_tokens},
      ${result.output_tokens}, ${result.reasoning_tokens},
      ${result.billed_cost_micros}, ${result.error_category},
      ${result.started_at}::timestamptz, ${result.method}, ${result.request_path}
    )
  `
  if (!rows[0]?.complete_call_v1) throw new Error("model execution receipt failed")
}
