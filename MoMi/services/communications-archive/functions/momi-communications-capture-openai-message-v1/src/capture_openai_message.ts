import { getDatabase } from "./database.ts"
import type {
  CaptureOpenaiMessageRequest,
  CaptureOpenaiMessageResult,
} from "./types.ts"

export async function captureOpenaiMessage(
  input: CaptureOpenaiMessageRequest,
): Promise<CaptureOpenaiMessageResult> {
  const sql = getDatabase()
  const rows = await sql<CaptureOpenaiMessageResult[]>`
    select captured.disposition, captured.archive_item_id,
      captured.evaluation_job_id::text as evaluation_job_id
    from momi_communications.capture_openai_message_v1(
      ${input.source_account_key},
      ${input.source_user_key},
      ${input.source_conversation_key},
      ${input.source_message_key},
      ${input.sender_role},
      ${input.occurred_at},
      ${sql.json(input.payload)},
      ${input.idempotency_key},
      ${input.captured_at ?? null},
      ${sql.json(input.source_metadata ?? {})},
      ${input.raw_text ?? null},
      ${input.source_parent_message_key ?? null},
      ${input.capture_actor ?? null},
      ${input.tool_version ?? null},
      ${input.model_version ?? null},
      ${input.prompt_version ?? null}
    ) as captured
  `
  return rows[0]
}
