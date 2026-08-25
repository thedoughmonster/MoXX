import type { JSONValue } from "postgres"
import { captureEvidence } from "./capture_evidence.ts"
import { completeLogInvocation } from "./complete_log_invocation.ts"
import { createUserFlagLog } from "./create_user_flag_log.ts"
import { logReceipt } from "./log_receipt.ts"
import { logReconciliationResponse } from "./log_reconciliation_response.ts"
import { logSuccessResponse } from "./log_success_response.ts"
import type { ChatInput, LogSelection } from "./types.ts"

const providerKey = "momi-internal"
const providerModel = "provider-free-log"

export async function reconcileLogInvocation(
  input: ChatInput,
  selection: LogSelection,
  invocationId: string,
): Promise<{ status: number; body: Record<string, JSONValue> }> {
  try {
    const requestReceipt = await captureEvidence(input, invocationId, 0,
      "log_request_admission", { input: input as unknown as JSONValue,
        selection: selection as unknown as JSONValue }, providerKey, providerModel, "pending")
    const appended = logReceipt(await createUserFlagLog(selection.flag,
      selection.content, { input, invocationId,
        archiveReceiptId: requestReceipt.archive_item_id }))
    if (!appended) return logReconciliationResponse(invocationId)
    const response = logSuccessResponse(invocationId, appended)
    const terminalReceipt = await captureEvidence(input, invocationId, 1,
      "log_append_result", { result: response }, providerKey, providerModel, "completed")
    await completeLogInvocation(invocationId, terminalReceipt.archive_item_id, response)
    return { status: 200, body: response }
  } catch {
    return logReconciliationResponse(invocationId)
  }
}
