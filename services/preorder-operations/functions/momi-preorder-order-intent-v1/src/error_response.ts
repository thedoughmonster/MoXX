import { envelope } from "./response.ts";
import { responseHeaders } from "./response_headers.ts";
import type { Failure } from "./types.ts";

export function errorResponse(
  requestId: string,
  status: number,
  error: Failure,
): Response {
  return Response.json(envelope(requestId, { error }), {
    status,
    headers: responseHeaders(),
  });
}
