import { admitCall } from "./admit_call.ts"
import { estimateTokens } from "./estimate_tokens.ts"
import { executeProvider } from "./execute_provider.ts"
import { hashPayload } from "./hash_payload.ts"
import { persistResult } from "./persist_result.ts"
import { providerRequest } from "./provider_request.ts"
import { publicResult } from "./public_result.ts"
import type { CallerKey, CreateRequest, ProviderConfig } from "./types.ts"

export async function executeCreate(
  caller: CallerKey,
  request: CreateRequest,
): Promise<Response> {
  const hash = await hashPayload(request)
  const admission = await admitCall(caller, request, hash, estimateTokens(request.payload))
  if (admission.disposition === "duplicate") {
    return Response.json({ ok: false,
      ambiguous: admission.status === "paid_ambiguous", status: 409,
      body: { error: { type: "model_execution_duplicate" },
        provider_response_id: admission.provider_response_id },
      duration_ms: 0, call_id: admission.call_id,
      provider_model: admission.provider_model }, { status: 409 })
  }
  const config: ProviderConfig = admission
  const result = await executeProvider(config, "POST", "/v1/responses",
    request.deadline_at, providerRequest(request, admission))
  await persistResult(admission.call_id, result)
  return Response.json(publicResult(admission.call_id,
    admission.provider_model, result))
}
