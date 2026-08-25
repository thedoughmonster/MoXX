import { envelope } from "./response.ts";
import { responseHeaders } from "./response_headers.ts";

export function errorResponse(
  request: Request,
  requestId: string,
  status: number,
  code: string,
  message: string,
  retryable = false,
  nextAction = "none",
): Response {
  return Response.json(envelope(requestId, {
    error: { code, message, retryable, next_action: nextAction },
  }), { status, headers: responseHeaders(request) });
}
