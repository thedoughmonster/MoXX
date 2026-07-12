import { isSecretKeyAuthorization } from "./authorize_request.ts"
import { parseRawEventId } from "./parse_request.ts"
import { processDispatch } from "./process_dispatch.ts"
import { recordDispatchFailure } from "./record_dispatch_failure.ts"

export async function handleRequest(request: Request): Promise<Response> {
  const isAuthorized = isSecretKeyAuthorization(
    request.headers.get("apikey"),
    Deno.env.get("SUPABASE_SECRET_KEYS"),
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
    const outcome = await processDispatch(rawEventId)

    if (!outcome.event_found) {
      return Response.json(
        { ok: false, raw_event_id: rawEventId, ...outcome },
        { status: 404 },
      )
    }

    return Response.json({ ok: true, raw_event_id: rawEventId, ...outcome })
  } catch (error) {
    console.error("Toast alert eligibility failed", rawEventId, error)

    try {
      await recordDispatchFailure(rawEventId)
    } catch (recordError) {
      console.error("Toast alert dispatch failure recording failed", rawEventId, recordError)
    }

    return new Response("eligibility failed", { status: 500 })
  }
}
