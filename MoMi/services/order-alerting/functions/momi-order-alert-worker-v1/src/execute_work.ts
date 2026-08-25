import { callOrderApi } from "./call_order_api.ts"
import { claimWork } from "./claim_work.ts"
import { completeWork } from "./complete_work.ts"
import { isValidOrderResponse } from "./is_valid_order_response.ts"
import { issueOrderReadCapability } from "./issue_order_read_capability.ts"
import { readPublishableKey } from "./read_publishable_key.ts"
import { recordFailure } from "./record_failure.ts"
import { revokeOrderReadCapability } from "./revoke_order_read_capability.ts"
import { exactOrderContractKey, functionKey,
  latestOrderContractKey } from "./types.ts"
import type { DeliveryTrigger } from "./delivery_types.ts"
import type { CanonicalReadCapability, ExecutionResult,
  WorkTriggerInput } from "./types.ts"

export async function executeWork(
  input: WorkTriggerInput,
  delivery: DeliveryTrigger | null = null,
): Promise<ExecutionResult> {
  const codeSha = Deno.env.get("MOMI_CODE_COMMIT_SHA")
  const projectUrl = Deno.env.get("SUPABASE_URL")
  const gatewayKey = readPublishableKey()
  if (!codeSha || !projectUrl || !gatewayKey) {
    throw new Error("Worker runtime configuration is incomplete")
  }
  const job = await claimWork(
    input,
    codeSha,
    Deno.env.get("DENO_DEPLOYMENT_ID") ?? null,
  )
  if (job.disposition === "not_found") {
    return { status: 404, body: { ok: false, function_key: functionKey,
      work_id: input.work_id, error: "work_not_found" } }
  }
  if (job.disposition === "unavailable") {
    return { status: 409, body: { ok: false, function_key: functionKey,
      work_id: input.work_id, error: "work_unavailable" } }
  }
  if (job.disposition === "already_succeeded") {
    return { status: 200, body: { ok: true, function_key: functionKey,
      work_id: input.work_id, replay: true } }
  }
  try {
    const canonical = job.api_contract_key === exactOrderContractKey ||
      job.api_contract_key === latestOrderContractKey
    let readCapability: CanonicalReadCapability | null = null
    if (canonical) {
      if (!delivery) {
        throw new Error("Canonical read requires exact delivery authority")
      }
      readCapability = await issueOrderReadCapability(job, delivery)
    } else if (delivery) {
      throw new Error("Legacy read cannot use delivery authority")
    }
    let response
    try {
      response = await callOrderApi(
        job, projectUrl, gatewayKey, readCapability,
      )
    } finally {
      if (readCapability) {
        await revokeOrderReadCapability(job, readCapability.work_id)
      }
    }
    if (response.status !== 200 ||
      !isValidOrderResponse(response.body, job, readCapability)) {
      const code = response.status === 200
        ? "order_api_contract_mismatch"
        : "order_api_http_error"
      await recordFailure(job, response.status, code,
        "Registered MoMi Order API returned an unexpected response",
        { api_contract_key: job.api_contract_key,
          response_headers: response.response_headers })
      return { status: 502, body: { ok: false, function_key: functionKey,
        work_id: job.work_id, error: code } }
    }
    const outcome = await completeWork(job, response, response.body)
    return { status: 200, body: { ok: true, function_key: functionKey,
      work_id: job.work_id, outcome } }
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    await recordFailure(job, null, "order_api_request_failed",
      "Registered MoMi Order API request failed", { error_name: errorName,
        api_contract_key: job.api_contract_key })
    return { status: 502, body: { ok: false, function_key: functionKey,
      work_id: job.work_id, error: "order_api_request_failed" } }
  }
}
