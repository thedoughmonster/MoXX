import { getDatabase } from "../../momi-model-execution-gateway-v1/src/database.ts"
import type { CompletionInput } from "../../momi-model-execution-completion-worker-v1/src/types.ts"

export async function acceptWebhook(input: {
  webhook_id: string
  event_id: string
  event_type: string
  provider_response_id: string
  provider_created_at: string
}): Promise<{ disposition: string; work: CompletionInput | null }> {
  const sql = getDatabase()
  const rows = await sql<{ disposition: string; work_id: string | null;
    capability_token: string | null }[]>`
    select disposition, work_id::text, capability_token::text
    from momi_model_execution.accept_openai_webhook_v1(
      ${input.webhook_id}, ${input.event_id}, ${input.event_type},
      ${input.provider_response_id}, ${input.provider_created_at}::timestamptz
    )
  `
  const row = rows[0]
  if (!row) throw new Error("webhook_accept_failed")
  return { disposition: row.disposition,
    work: row.work_id && row.capability_token
      ? { work_id: row.work_id, capability_token: row.capability_token } : null }
}
