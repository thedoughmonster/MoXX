import { parsePaymentEvidence } from "../../../src/parse_payment_evidence.ts"
import { archiveContext } from "./archive_context.ts"
import { digestRawBody } from "./digest_raw_body.ts"
import { parseRawPayload } from "./parse_raw_payload.ts"
import { readRawBody } from "./read_raw_body.ts"
import { successResponse } from "./success_response.ts"
import type { WebhookDependencies } from "./types.ts"

export async function processWebhook(
  request: Request,
  dependencies: WebhookDependencies,
): Promise<Response> {
  if (request.method !== "POST") return new Response("method not allowed", {
    status: 405, headers: { Allow: "POST" },
  })
  const signature = request.headers.get("x-square-hmacsha256-signature")
  if (!signature || signature.length > 512) {
    return new Response("invalid signature", { status: 401 })
  }
  let rawBody: Uint8Array
  try {
    rawBody = await readRawBody(request)
  } catch {
    return new Response("payload too large", { status: 413 })
  }
  let result
  try {
    result = await dependencies.authenticate(rawBody, signature)
  } catch {
    return new Response("service unavailable", { status: 503 })
  }
  if (result.disposition === "rejected") {
    return new Response("invalid signature or payload", { status: 401 })
  }
  if (result.disposition === "unavailable") {
    return new Response("service unavailable", { status: 503 })
  }
  const parsed = parseRawPayload(rawBody)
  if (!parsed) return new Response("invalid payload", { status: 400 })
  const evidence = result.evidence
    ? parsePaymentEvidence(result.evidence)
    : null
  if ((result.evidence && (!evidence || evidence.source !== "webhook")) ||
      (result.disposition === "authenticated" && !evidence)) {
    return new Response("invalid provider evidence", { status: 503 })
  }
  try {
    const context = archiveContext(
      result, evidence, await digestRawBody(rawBody), dependencies.getLocationId(),
    )
    if (context.locationId.length < 1 || context.locationId.length > 64) {
      return new Response("service unavailable", { status: 503 })
    }
    await dependencies.capture(parsed.rawText, parsed.payload, context)
  } catch {
    return new Response("persistence failed", { status: 503 })
  }
  if (result.disposition === "ignored") return successResponse("ignored")
  if (result.disposition === "retryable" || !evidence) {
    return new Response("provider unavailable", { status: 503 })
  }
  try {
    const paymentAttemptId = await dependencies.resolve(evidence)
    if (!paymentAttemptId) return successResponse("unmatched")
    const projection = await dependencies.project(paymentAttemptId, evidence)
    if (!projection.receipt && projection.error) {
      return new Response("projection failed", { status: 503 })
    }
    return successResponse(projection.disposition ?? "applied")
  } catch {
    return new Response("projection failed", { status: 503 })
  }
}
