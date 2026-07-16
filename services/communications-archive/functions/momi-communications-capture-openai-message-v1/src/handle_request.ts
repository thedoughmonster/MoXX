import { isAuthorizedRequest } from "./authorize_request.ts"
import { captureOpenaiMessage } from "./capture_openai_message.ts"
import { parseRequest } from "./parse_request.ts"

export async function handleRequest(request: Request): Promise<Response> {
  if (!isAuthorizedRequest(request)) {
    return new Response("unauthorized", { status: 401 })
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

  const parsed = parseRequest(await request.json().catch(() => null))
  if (!parsed) {
    return new Response("invalid payload", { status: 400 })
  }

  try {
    const result = await captureOpenaiMessage(parsed)
    return Response.json({ ok: true, ...result })
  } catch (error) {
    console.error("Communication archive capture failed", error)
    const missingDatabase = error instanceof Error &&
      error.message === "SUPABASE_DB_URL is not configured"
    return new Response(missingDatabase ? "service unavailable" : "persistence failed", {
      status: missingDatabase ? 503 : 500,
    })
  }
}
