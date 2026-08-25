import { executeProvider } from "../../momi-model-execution-gateway-v1/src/execute_provider.ts"
import { getCall } from "../../momi-model-execution-gateway-v1/src/get_call.ts"
import { persistResult } from "../../momi-model-execution-gateway-v1/src/persist_result.ts"
import { providerStatus } from "../../momi-model-execution-gateway-v1/src/provider_status.ts"
import type { ProviderConfig } from "../../momi-model-execution-gateway-v1/src/types.ts"
import { claimCompletion } from "./claim_completion.ts"
import { completeWork } from "./complete_work.ts"
import { retryWork } from "./retry_work.ts"
import { notifyCaller } from "./notify_caller.ts"
import type { CompletionInput } from "./types.ts"

export async function processCompletion(input: CompletionInput): Promise<string> {
  const work = await claimCompletion(input)
  if (!work) return "duplicate"
  try {
    const call = await getCall(work.call_id)
    if (!call || call.provider_response_id !== work.provider_response_id ||
      call.caller_key !== work.caller_key) throw new Error("completion_call_mismatch")
    const config: ProviderConfig = {
      call_id: work.call_id,
      provider_endpoint: call.provider_endpoint,
      provider_model: call.provider_model,
      timeout_seconds: call.timeout_seconds,
      x_client_request_id: call.x_client_request_id,
      input_micros_per_token: call.input_micros_per_token,
      output_micros_per_token: call.output_micros_per_token,
    }
    const result = await executeProvider(config, "GET",
      `/v1/responses/${encodeURIComponent(work.provider_response_id)}`,
      new Date(Date.now() + Math.min(120, work.timeout_seconds) * 1000).toISOString(), null)
    await persistResult(work.call_id, result)
    if (providerStatus(result.body, result.ok, result.ambiguous) === "pending") {
      await retryWork(work, "provider_response_pending")
      return "retrying"
    }
    if (!await notifyCaller(work)) {
      await retryWork(work, "caller_callback_failed")
      return "retrying"
    }
    await completeWork(work)
    return "completed"
  } catch (error) {
    const code = error instanceof Error ? error.message : "completion_failed"
    await retryWork(work, code).catch(() => undefined)
    throw error
  }
}
