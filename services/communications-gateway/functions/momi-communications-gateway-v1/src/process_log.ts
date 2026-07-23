import type { JSONValue } from "postgres"
import { admitLogInvocation } from "./admit_log_invocation.ts"
import { archiveFailure } from "./archive_failure.ts"
import { captureEvidence } from "./capture_evidence.ts"
import { completeLogInvocation } from "./complete_log_invocation.ts"
import { createUserFlagLog } from "./create_user_flag_log.ts"
import { hashRequest } from "./hash_request.ts"
import { loadInvocationReplay } from "./load_invocation_replay.ts"
import { logReceipt } from "./log_receipt.ts"
import { logReconciliationResponse } from "./log_reconciliation_response.ts"
import { logReplayResponse } from "./log_replay_response.ts"
import { logSuccessResponse } from "./log_success_response.ts"
import { markArchiveAdmitted } from "./mark_archive_admitted.ts"
import { reconcileLogInvocation } from "./reconcile_log_invocation.ts"
import type { Admission, ChatInput, LogSelection } from "./types.ts"

const providerKey = "momi-internal"
const providerModel = "provider-free-log"

export async function processLog(input: ChatInput, selection: LogSelection): Promise<{
  status: number
  body: Record<string, JSONValue>
}> {
  const requestHash = await hashRequest(input, "momi.communications.log-intent.v2")
  const admitted = await admitLogInvocation(input, requestHash)
  if (admitted.disposition === "duplicate") {
    const replay = await loadInvocationReplay(input, admitted.invocation_id, requestHash)
    if (replay.invocation_status === "admitted") {
      return await reconcileLogInvocation(input, selection, admitted.invocation_id)
    }
    return logReplayResponse(admitted.invocation_id, replay)
  }
  const admission: Admission = { ...admitted, provider_key: providerKey,
    provider_model: providerModel, provider_endpoint: "", maximum_output_tokens: 0,
    maximum_input_tokens: 0, timeout_seconds: 0, maximum_attempt_cost_micros: "0",
    invocation_deadline: "" }
  let archiveAdmitted = false
  let appendAttempted = false
  try {
    const requestReceipt = await captureEvidence(input, admitted.invocation_id, 0,
      "log_request_admission", { input: input as unknown as JSONValue,
        selection: selection as unknown as JSONValue }, providerKey, providerModel, "pending")
    if (!await markArchiveAdmitted(admitted.invocation_id,
      requestReceipt.archive_item_id)) throw new Error("archive_admission_state_failed")
    archiveAdmitted = true
    appendAttempted = true
    const appended = logReceipt(await createUserFlagLog(selection.flag,
      selection.content, { input, invocationId: admitted.invocation_id,
        archiveReceiptId: requestReceipt.archive_item_id }))
    if (!appended) return logReconciliationResponse(admitted.invocation_id)
    const response = logSuccessResponse(admitted.invocation_id, appended)
    const terminalReceipt = await captureEvidence(input, admitted.invocation_id, 1,
      "log_append_result", { result: response }, providerKey, providerModel, "completed")
    await completeLogInvocation(admitted.invocation_id,
      terminalReceipt.archive_item_id, response)
    return { status: 200, body: response }
  } catch {
    if (appendAttempted) return logReconciliationResponse(admitted.invocation_id)
    if (archiveAdmitted) await archiveFailure(input, admission, "log_append_failed")
    return { status: 503, body: {
      id: admitted.invocation_id, object: "momi.log", model: "momi-assistant",
      status: "failed", error: "request_failed",
    } }
  }
}
