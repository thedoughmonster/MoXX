import type { JSONValue } from "postgres"
import { completeInvocation } from "./complete_invocation.ts"
import { outputTokens } from "./output_tokens.ts"
import { terminalLimitationResponse } from "./terminal_limitation_response.ts"
import type { Admission } from "./types.ts"

export async function completeProviderLimitation(
  admission: Admission,
  receiptId: string,
  providerBody: Record<string, JSONValue>,
  code: string,
): Promise<{ status: number; body: Record<string, JSONValue> }> {
  const response = terminalLimitationResponse(admission.invocation_id, code)
  await completeInvocation(
    admission.invocation_id,
    "completed",
    receiptId,
    outputTokens(providerBody),
    code,
    response.body,
  )
  return response
}
