import type { JSONValue } from "postgres"
import { captureEvidence } from "./capture_evidence.ts"
import { completeInvocation } from "./complete_invocation.ts"
import { getDatabase } from "./database.ts"
import { terminalLimitationResponse } from "./terminal_limitation_response.ts"
import type { Admission, ChatInput } from "./types.ts"

export async function completeVisibleLimitation(
  input: ChatInput,
  admission: Admission,
  code: string,
): Promise<{ status: number; body: Record<string, JSONValue> }> {
  const sql = getDatabase()
  const rows = await sql<{ provider_model: string }[]>`
    select provider_model from momi_communications_gateway.invocations
    where invocation_id = ${admission.invocation_id}::uuid
  `
  const response = terminalLimitationResponse(admission.invocation_id, code)
  const receipt = await captureEvidence(
    input,
    admission.invocation_id,
    90,
    "visible_terminal_limitation",
    { limitation_code: code },
    admission.provider_key,
    rows[0]?.provider_model ?? admission.provider_model,
    "completed",
  )
  await completeInvocation(
    admission.invocation_id,
    "completed",
    receipt.archive_item_id,
    0,
    code,
    response.body,
  )
  return response
}
