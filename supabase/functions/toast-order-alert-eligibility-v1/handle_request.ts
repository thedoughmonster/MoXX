import { isServiceRoleAuthorization } from "./authorize_request.ts"
import { claimCandidates } from "./claim_candidates.ts"
import { parseRawEventId } from "./parse_request.ts"

export async function handleRequest(request: Request): Promise<Response> {
  const isAuthorized = isServiceRoleAuthorization(
    request.headers.get("authorization"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  )

  if (!isAuthorized) {
    return new Response("forbidden", { status: 403 })
  }

  if (request.method === "GET") {
    return Response.json({ ok: true })
  }

  if (request.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
      headers: { Allow: "GET, POST" },
    })
  }

  let input: unknown

  try {
    input = await request.json()
  } catch {
    return new Response("invalid request", { status: 400 })
  }

  const rawEventId = parseRawEventId(input)

  if (!rawEventId) {
    return new Response("invalid request", { status: 400 })
  }

  try {
    const outcome = await claimCandidates(rawEventId)

    if (!outcome.event_found) {
      return Response.json(
        { ok: false, raw_event_id: rawEventId, ...outcome },
        { status: 404 },
      )
    }

    return Response.json({ ok: true, raw_event_id: rawEventId, ...outcome })
  } catch (error) {
    console.error("Toast alert eligibility failed", rawEventId, error)
    return new Response("eligibility failed", { status: 500 })
  }
}
