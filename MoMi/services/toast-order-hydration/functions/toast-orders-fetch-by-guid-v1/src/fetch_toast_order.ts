import { parseSourceBody } from "./parse_source_body.ts"
import { selectSafeHeaders } from "./select_safe_headers.ts"
import type { ToastOrderRequest, ToastOrderResponse } from "./types.ts"

export async function fetchToastOrder(
  input: ToastOrderRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ToastOrderResponse> {
  const path = `/orders/v2/orders/${encodeURIComponent(input.order_guid)}`
  const url = new URL(path, `${input.api_base_url.replace(/\/+$/, "")}/`)
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Authorization: `${input.token_type} ${input.access_token}`,
      "Toast-Restaurant-External-ID": input.restaurant_guid,
    },
    signal: AbortSignal.timeout(input.request_timeout_ms),
  })
  const rawBody = await response.text()

  return {
    status: response.status,
    body: parseSourceBody(rawBody),
    raw_body: rawBody,
    response_headers: selectSafeHeaders(response.headers),
  }
}
