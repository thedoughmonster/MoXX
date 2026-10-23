import { errorResponse } from "./error_response.ts"
import { parseRequest } from "./parse_request.ts"
import { responseHeaders } from "./response_headers.ts"
import { revalidate } from "./revalidate.ts"
import { functionKey, type Reader } from "./types.ts"

export async function handleRequestWithReader(
  request: Request, reader: Reader,
): Promise<Response> {
  const requestId = crypto.randomUUID()
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseHeaders() })
  }
  if (request.method !== "POST") return new Response("method not allowed", {
    status: 405, headers: { ...responseHeaders(), Allow: "POST, OPTIONS" },
  })
  const input = await parseRequest(request)
  if (!input) return errorResponse(requestId, 400, "invalid_request",
    "The preorder contribution is invalid.", false, "none")
  try {
    const result = await reader(input)
    if (!result.admitted) {
      const response = errorResponse(requestId, 429, "rate_limited",
        "Too many preorder requests were received.", true, "retry_later")
      response.headers.set("Retry-After", "60")
      return response
    }
    return Response.json({ meta: { contract_key: functionKey,
      request_id: requestId, generated_at: new Date().toISOString() },
      ...revalidate(input, result.data) }, { headers: responseHeaders() })
  } catch {
    return errorResponse(requestId, 503, "not_found",
      "Preordering is temporarily unavailable.", true, "retry_later")
  }
}
