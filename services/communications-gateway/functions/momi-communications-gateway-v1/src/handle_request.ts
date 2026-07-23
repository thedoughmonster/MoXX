import { handleAdmin } from "./handle_admin.ts"
import { isAdminAuthorized } from "./is_admin_authorized.ts"
import { isAuthorized } from "./is_authorized.ts"
import { listModels } from "./list_models.ts"
import { parseChatInput } from "./parse_chat_input.ts"
import { processChat } from "./process_chat.ts"
import { processLog } from "./process_log.ts"
import { publicGatewayFailure } from "./public_gateway_failure.ts"
import { structuredSelection } from "./structured_log_selection.ts"

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
  if (!pathname.endsWith("/chat/completions") && !pathname.endsWith("/log")) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }
  const input = parseChatInput(body)
  if (!input) return Response.json({ error: "invalid_request" }, { status: 400 })
  try {
    const selection = input.momi_log ? structuredSelection(input, input.momi_log) : null
    if (pathname.endsWith("/log") && (!selection || input.momi_route !== undefined)) {
      return Response.json({ error: "invalid_log_request" }, { status: 400 })
    }
    const result = pathname.endsWith("/log")
      ? await processLog(input, selection!)
      : await processChat(input)
    return Response.json(result.body, { status: result.status })
  } catch (error) {
    const failure = publicGatewayFailure(error)
    return Response.json(failure.body, { status: failure.status })
  }
}
