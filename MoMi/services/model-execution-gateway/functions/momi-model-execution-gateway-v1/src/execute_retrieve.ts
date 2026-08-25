import { executeProvider } from "./execute_provider.ts"
import { getCall } from "./get_call.ts"
import { persistResult } from "./persist_result.ts"
import { publicResult } from "./public_result.ts"
import type { CallerKey, ProviderConfig, RetrieveRequest } from "./types.ts"

export async function executeRetrieve(
  caller: CallerKey,
  request: RetrieveRequest,
): Promise<Response> {
  const call = await getCall(request.call_id)
  if (!call || call.caller_key !== caller ||
      call.provider_response_id !== request.provider_response_id) {
    return Response.json({ error: "model execution call not found" }, { status: 404 })
  }
  if (call.status === "paid_ambiguous") {
    return Response.json({ error: "ambiguous calls cannot be retrieved" }, { status: 409 })
  }
  const config: ProviderConfig = { call_id: request.call_id,
    provider_endpoint: call.provider_endpoint, provider_model: call.provider_model,
    timeout_seconds: call.timeout_seconds,
    x_client_request_id: call.x_client_request_id,
    input_micros_per_token: call.input_micros_per_token,
    output_micros_per_token: call.output_micros_per_token }
  const path = `/v1/responses/${encodeURIComponent(request.provider_response_id)}`
  const result = await executeProvider(config, "GET", path,
    request.deadline_at, null)
  await persistResult(request.call_id, result)
  return Response.json(publicResult(request.call_id, call.provider_model, result))
}
