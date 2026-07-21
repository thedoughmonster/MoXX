import { handleAdmin } from "./handle_admin.ts"
import { isAdminAuthorized } from "./is_admin_authorized.ts"
import { isAuthorized } from "./is_authorized.ts"
import { listModels } from "./list_models.ts"
import { parseChatInput } from "./parse_chat_input.ts"
import { processChat } from "./process_chat.ts"

export async function handleRequest(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname
  if (pathname.includes("/admin/")) {
    if (!isAdminAuthorized(request)) {
      return new Response("unauthorized", { status: 401 })
    }
    if (request.method !== "POST") {
      return new Response("method not allowed", {
        status: 405,
        headers: { Allow: "POST" },
      })
    }
    const body: unknown = await request.json().catch(() => null)
    try {
      return await handleAdmin(pathname, body)
    } catch {
      return Response.json({ error: "administration_failed" }, { status: 400 })
    }
  }
  if (!isAuthorized(request)) return new Response("unauthorized", { status: 401 })
  if (request.method === "GET" && pathname.endsWith("/models")) {
    try { return Response.json(await listModels()) }
    catch { return Response.json({ error: "service_unavailable" }, { status: 503 }) }
  }
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: { Allow: "GET, POST" } })
  }
  const body: unknown = await request.json().catch(() => null)
  if (!pathname.endsWith("/chat/completions")) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }
  const input = parseChatInput(body)
  if (!input) return Response.json({ error: "invalid_request" }, { status: 400 })
  try {
    const result = await processChat(input)
    return Response.json(result.body, { status: result.status })
  } catch {
    return Response.json({ error: "gateway_failed_closed" }, { status: 503 })
  }
}
