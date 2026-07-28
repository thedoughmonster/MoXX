import { functionKey } from "./types.ts"
import { responseHeaders } from "./response_headers.ts"

export function errorResponse(
  requestId: string,
  status: number,
  code: string,
  message: string,
  retryable: boolean,
  nextAction: string,
): Response {
  return Response.json({
    meta: {
      contract_key: functionKey,
      request_id: requestId,
      generated_at: new Date().toISOString(),
    },
    error: { code, message, retryable, next_action: nextAction },
  }, { status, headers: responseHeaders() })
}
