import { executeRouting } from "./execute_routing.ts"
import { parseRoutingInput } from "./parse_request.ts"
import { functionKey } from "./types.ts"

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return Response.json({ ok: true, function_key: functionKey,
      event_id: "health", disposition: "healthy" })
  }
  if (request.method !== "POST") {
    return new Response("method not allowed", {
      status: 405, headers: { Allow: "GET, POST" },
    })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const input = parseRoutingInput(body)
  if (!input) {
    return Response.json({ ok: false, function_key: functionKey,
      event_id: "unknown", disposition: "invalid_request" }, { status: 400 })
  }
  const result = await executeRouting(input)
  return Response.json(result.body, { status: result.status })
}
