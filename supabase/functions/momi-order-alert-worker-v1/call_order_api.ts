import type { ClaimedWork, OrderApiResponse } from "./types.ts"

export async function callOrderApi(
  job: ClaimedWork,
  projectUrl: string,
  gatewayKey: string,
  fetcher: typeof fetch = fetch,
): Promise<OrderApiResponse> {
  const project = new URL(projectUrl)
  const endpoint = new URL(job.api_route_path, project)
  if (
    !job.api_route_path.startsWith("/functions/v1/") ||
    job.api_route_path.startsWith("//") ||
    endpoint.origin !== project.origin || endpoint.search !== "" ||
    endpoint.hash !== "" || endpoint.pathname !== job.api_route_path
  ) {
    throw new Error("Registered Order API route must be an exact same-origin Edge Function path")
  }
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: gatewayKey,
    },
    body: JSON.stringify({
      work_id: job.work_id,
      order_id: job.order_id,
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
