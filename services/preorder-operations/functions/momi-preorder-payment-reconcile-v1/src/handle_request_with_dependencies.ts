import type { Failure } from "../../../src/payment_types.ts"
import { publicOriginPolicy } from "../../../src/public_origin.ts"
import { envelope } from "./envelope.ts"
import { errorResponse } from "./error_response.ts"
import { orchestrate } from "./orchestrate.ts"
import { parseRequest } from "./parse_request.ts"
import { readJsonBody } from "./read_json_body.ts"
import { responseHeaders } from "./response_headers.ts"
import type { ReconcileDependencies } from "./types.ts"

const invalid: Failure = {
  code: "invalid_request", message: "The reconciliation request is invalid.",
  retryable: false, next_action: "none",
}

export async function handleRequestWithDependencies(
  request: Request,
  dependencies: ReconcileDependencies,
): Promise<Response> {
  const requestId = crypto.randomUUID()
  if (!publicOriginPolicy.isAllowed(request)) return errorResponse(
    request, requestId, 403, { code: "not_authorized",
      message: "This browser origin is not allowed.", retryable: false,
      next_action: "none" },
  )
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseHeaders(request) })
  }
  if (request.method !== "POST") return errorResponse(request, requestId, 405, invalid)
  let raw: unknown
  try {
    raw = await readJsonBody(request)
  } catch {
    return errorResponse(request, requestId, 400, invalid)
  }
  const input = parseRequest(raw)
  if (!input) return errorResponse(request, requestId, 400, invalid)
  try {
    const execution = await orchestrate(
      input,
      request.headers.get("x-momi-recovery-authority") ?? "",
      dependencies,
    )
    if (!execution.admitted) {
      const response = errorResponse(request, requestId, 429, {
        code: "rate_limited", message: "Too many payment requests were received.",
        retryable: true, next_action: "retry_later",
      })
      response.headers.set("Retry-After", "60")
      return response
    }
    const result = execution.result
    if (!result) throw new Error("invalid_reconcile_result")
    if (result.error) return errorResponse(
      request, requestId, result.outcome === "conflict" ? 409 : 422,
      result.error,
    )
    if (!result.receipt) throw new Error("invalid_reconcile_result")
    return Response.json(envelope(requestId, result.receipt), {
      headers: responseHeaders(request),
    })
  } catch {
    return errorResponse(request, requestId, 503, {
      code: "payment_indeterminate",
      message: "Payment status is temporarily unavailable.",
      retryable: true, next_action: "retry_later",
    })
  }
}
