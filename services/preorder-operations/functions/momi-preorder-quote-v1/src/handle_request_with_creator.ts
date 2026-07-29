import { errorResponse } from "./error_response.ts";
import { parseRequest } from "./parse_request.ts";
import { responseHeaders } from "./response_headers.ts";
import { functionKey, type QuoteCreator } from "./types.ts";

export async function handleRequestWithCreator(
  request: Request,
  creator: QuoteCreator,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseHeaders() });
  }
  if (request.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
      headers: { ...responseHeaders(), Allow: "POST, OPTIONS" },
    });
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(
      requestId,
      400,
      "invalid_request",
      "The quote request is invalid.",
      false,
      "none",
    );
  }
  const input = parseRequest(raw);
  if (!input) {
    return errorResponse(
      requestId,
      400,
      "invalid_request",
      "The quote request is invalid.",
      false,
      "none",
    );
  }
  try {
    const creation = await creator(input);
    if (!creation.admitted) {
      const response = errorResponse(
        requestId,
        429,
        "rate_limited",
        "Too many quote requests were received.",
        true,
        "retry_later",
      );
      response.headers.set("Retry-After", "60");
      return response;
    }
    const result = creation.result;
    if (!result) {
      return errorResponse(
        requestId,
        503,
        "not_found",
        "Quoting is temporarily unavailable.",
        true,
        "retry_later",
      );
    }
    if (result.error) {
      return errorResponse(
        requestId,
        result.outcome === "conflict" ? 409 : 422,
        result.error.code,
        result.error.message,
        result.error.retryable,
        result.error.next_action,
      );
    }
    return Response.json({
      meta: {
        contract_key: functionKey,
        request_id: requestId,
        generated_at: new Date().toISOString(),
      },
      outcome: result.outcome,
      quote: result.quote ?? null,
    }, { headers: responseHeaders() });
  } catch {
    return errorResponse(
      requestId,
      503,
      "not_found",
      "Quoting is temporarily unavailable.",
      true,
      "retry_later",
    );
  }
}
