import { canonicalOrderContractKey, legacyOrderContractKey } from "./types.ts"
import type {
  CanonicalReadCapability,
  ClaimedWork,
  OrderApiResponse,
} from "./types.ts"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function callOrderApi(
  job: ClaimedWork,
  projectUrl: string,
  gatewayKey: string,
  readCapability: CanonicalReadCapability | null,
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
  let requestBody: Record<string, string>
  if (job.api_contract_key === canonicalOrderContractKey) {
    if (!readCapability || !/^[1-9][0-9]*$/.test(readCapability.work_id) ||
      !uuidPattern.test(readCapability.capability_token)) {
      throw new Error("Canonical Order API requires an exact read capability")
    }
    requestBody = { work_id: readCapability.work_id, order_id: job.order_id,
      capability_token: readCapability.capability_token }
  } else if (job.api_contract_key === legacyOrderContractKey) {
    if (readCapability) {
      throw new Error("Legacy Order API cannot receive a read capability")
    }
    requestBody = { work_id: job.work_id, order_id: job.order_id,
      trigger_token: job.trigger_token }
  } else {
    throw new Error("Order API contract is not supported")
  }
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: gatewayKey,
    },
    body: JSON.stringify(requestBody),
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
