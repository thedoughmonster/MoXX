import { parseRequest } from "./parse_request.ts";
import { errorResponse } from "./error_response.ts";
import { envelope } from "./response.ts";
import { responseHeaders } from "./response_headers.ts";
import type { Failure, OrderExecutor } from "./types.ts";

const invalid: Failure = {
  code: "invalid_request",
  message: "The order request is invalid.",
  retryable: false,
  next_action: "none",
};

export async function handleRequestWithExecutor(
  request: Request,
  executor: OrderExecutor,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseHeaders() });
  }
  if (request.method !== "POST") {
    return errorResponse(requestId, 405, invalid);
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(requestId, 400, invalid);
  }
  const input = parseRequest(raw);
  if (!input) return errorResponse(requestId, 400, invalid);
  try {
    const execution = await executor(
      input,
      request.headers.get("x-momi-checkout-authority") ?? "",
    );
    if (!execution.admitted) {
      const response = errorResponse(requestId, 429, {
        code: "rate_limited",
        message: "Too many order requests were received.",
        retryable: true,
        next_action: "retry_later",
      });
      response.headers.set("Retry-After", "60");
      return response;
    }
    if (!execution.result) {
      return errorResponse(requestId, 503, {
        code: "not_found",
        message: "Ordering is temporarily unavailable.",
        retryable: true,
        next_action: "retry_later",
      });
    }
    if (execution.result.error) {
      return errorResponse(
        requestId,
        execution.result.outcome === "conflict" ? 409 : 422,
        execution.result.error,
      );
    }
    return Response.json(envelope(requestId, execution.result), {
      headers: responseHeaders(),
    });
  } catch {
    return errorResponse(requestId, 503, {
      code: "not_found",
      message: "Ordering is temporarily unavailable.",
      retryable: true,
      next_action: "retry_later",
    });
  }
}
