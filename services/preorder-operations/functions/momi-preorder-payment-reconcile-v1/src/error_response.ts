import type { Failure } from "../../../src/payment_types.ts"
import { envelope } from "./envelope.ts"
import { responseHeaders } from "./response_headers.ts"

export function errorResponse(
  request: Request,
  requestId: string,
  status: number,
  error: Failure,
): Response {
  return Response.json(envelope(requestId, { error }), {
    status,
    headers: responseHeaders(request),
  })
}
