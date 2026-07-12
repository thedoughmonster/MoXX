import { claimJob } from "./claim_job.ts"
import { fetchToastOrder } from "./fetch_toast_order.ts"
import { getToastToken } from "./get_toast_token.ts"
import { hashSourceBody } from "./hash_source_body.ts"
import { isExpectedOrder } from "./is_expected_order.ts"
import { persistOrderResponse } from "./persist_order_response.ts"
import { readConfiguredSecret } from "./read_secret.ts"
import { recordFailure } from "./record_failure.ts"
import { functionKey, type ExecutionResult } from "./types.ts"

export async function executeJob(
  jobId: string,
  codeCommitSha: string,
  deploymentId: string | null,
): Promise<ExecutionResult> {
  const claim = await claimJob(jobId, functionKey, codeCommitSha, deploymentId)

  if (claim.disposition === "not_found") {
    return { status: 404, body: { ok: false, disposition: "not_found", job_id: jobId } }
  }
  if (claim.disposition === "unavailable") {
    return { status: 409, body: { ok: false, disposition: "unavailable", job_id: jobId } }
  }
  if (claim.disposition === "already_succeeded") {
    return { status: 200, body: { ok: true, ...claim } }
  }

  const clientId = readConfiguredSecret(claim.client_id_secret_name)
  const clientSecret = readConfiguredSecret(claim.client_secret_secret_name)
  if (!clientId || !clientSecret) {
    await recordFailure(
      claim,
      "toast_credentials_unavailable",
      "Toast credentials are unavailable",
      null,
      {},
      null,
    )
    return { status: 503, body: { ok: false, disposition: "failed", job_id: jobId, error: "source unavailable" } }
  }

  let auth
  try {
    auth = await getToastToken({
      api_base_url: claim.api_base_url,
      client_id: clientId,
      client_secret: clientSecret,
      user_access_type: claim.user_access_type,
      request_timeout_ms: claim.request_timeout_ms,
    })
  } catch {
    await recordFailure(claim, "toast_auth_network_error", "Toast authentication failed", null, {}, null)
    return { status: 502, body: { ok: false, disposition: "failed", job_id: jobId, error: "source unavailable" } }
  }

  if (!auth.ok || !auth.token_type || !auth.access_token) {
    await recordFailure(claim, "toast_auth_rejected", "Toast authentication failed", auth.status, {}, null)
    return { status: 502, body: { ok: false, disposition: "failed", job_id: jobId, error: "source unavailable" } }
  }

  let response
  try {
    response = await fetchToastOrder({
      api_base_url: claim.api_base_url,
      restaurant_guid: claim.restaurant_guid,
      order_guid: claim.order_guid,
      token_type: auth.token_type,
      access_token: auth.access_token,
      request_timeout_ms: claim.request_timeout_ms,
    })
  } catch {
    await recordFailure(claim, "toast_order_network_error", "Toast order request failed", null, {}, null)
    return { status: 502, body: { ok: false, disposition: "failed", job_id: jobId, error: "source unavailable" } }
  }

  if (response.status < 200 || response.status >= 300) {
    await recordFailure(claim, "toast_order_http_error", "Toast order request failed", response.status, response.response_headers, response.body)
    return { status: 502, body: { ok: false, disposition: "failed", job_id: jobId, error: "source unavailable" } }
  }

  const contentHash = await hashSourceBody(response.raw_body)
  const isValid = isExpectedOrder(response.body, claim.order_guid)
  const persisted = await persistOrderResponse(claim, response, contentHash, isValid)
  if (!isValid) {
    return { status: 502, body: { ok: false, disposition: "failed", job_id: jobId, attempt_id: claim.attempt_id, invocation_id: claim.invocation_id, order_version_id: persisted.order_version_id, error: "invalid source response" } }
  }

  return {
    status: 200,
    body: {
      ok: true,
      disposition: persisted.was_inserted ? "stored" : "duplicate",
      job_id: jobId,
      attempt_id: claim.attempt_id,
      invocation_id: claim.invocation_id,
      order_version_id: persisted.order_version_id,
    },
  }
}
