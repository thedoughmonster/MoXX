import { errorResponse } from "./error_response.ts";
import { envelope } from "./response.ts";
import { responseHeaders } from "./response_headers.ts";
import type { StatusReader } from "./types.ts";

export async function handleRequestWithReader(
  request: Request,
  reader: StatusReader,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseHeaders() });
  }
  if (request.method !== "GET") {
    return errorResponse(requestId, 405, "invalid_request", "Method not allowed.");
  }
  const orderId = new URL(request.url).searchParams.get("order_id") ?? "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(orderId)) {
    return errorResponse(
      requestId,
      400,
      "invalid_request",
      "The order request is invalid.",
    );
  }
  try {
    const result = await reader(
      orderId,
      request.headers.get("x-momi-recovery-authority") ?? "",
    );
    if (!result.admitted) {
      const response = errorResponse(
        requestId,
        429,
        "rate_limited",
        "Too many status requests were received.",
        true,
        "retry_later",
      );
      response.headers.set("Retry-After", "60");
      return response;
    }
    if (!result.data) {
      return errorResponse(
        requestId,
        404,
        "not_found",
        "The order was not found.",
      );
    }
    return Response.json(envelope(requestId, { data: result.data }), {
      headers: responseHeaders(),
    });
  } catch {
    return errorResponse(
      requestId,
      503,
      "not_found",
      "Order status is temporarily unavailable.",
      true,
      "retry_later",
    );
  }
}
