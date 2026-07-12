import { orderApiRoute } from "./types.ts"
import type { ClaimedWork, OrderApiResponse } from "./types.ts"

export async function callOrderApi(
  job: ClaimedWork,
  projectUrl: string,
  gatewayKey: string,
  fetcher: typeof fetch = fetch,
): Promise<OrderApiResponse> {
  const response = await fetcher(`${projectUrl.replace(/\/$/, "")}${orderApiRoute}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: gatewayKey,
    },
    body: JSON.stringify({
      work_id: job.work_id,
      order_guid: job.order_guid,
      trigger_token: job.trigger_token,
    }),
  })
  const body = await response.json().catch(() => null)
  const responseHeaders: Record<string, string> = {}
  for (const name of ["content-type", "sb-request-id", "x-deno-execution-id"]) {
    const value = response.headers.get(name)
    if (value) responseHeaders[name] = value
  }
  return {
    status: response.status,
    body,
    response_headers: responseHeaders,
  }
}
