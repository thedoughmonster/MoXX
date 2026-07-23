import { captureHumanMessage } from "./capture_human_message.ts"
import { isRelayAuthorized } from "./is_relay_authorized.ts"
import { parseInput } from "./parse_input.ts"

export async function handleRequest(request: Request): Promise<Response> {
  if (!isRelayAuthorized(request)) return new Response("unauthorized", { status: 401 })
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: { Allow: "POST" } })
  }
  const input = parseInput(await request.json().catch(() => null))
  if (!input) return new Response("invalid payload", { status: 400 })
  try {
    return Response.json({ ok: true, ...await captureHumanMessage(input) })
  } catch {
    return new Response("persistence failed", { status: 500 })
  }
}
