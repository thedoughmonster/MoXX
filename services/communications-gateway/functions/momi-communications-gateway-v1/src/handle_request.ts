import { handleAdmin } from "./handle_admin.ts"
import { isCompletionAuthorized } from "./completion_authorization.ts"
import { isAdminAuthorized } from "./is_admin_authorized.ts"
import { isAuthorized } from "./is_authorized.ts"
import { listModels } from "./list_models.ts"
import { logReleaseResponse } from "./log_release_response.ts"
import { parseChatInput } from "./parse_chat_input.ts"
import { parseCompletionCallback } from "./parse_completion_callback.ts"
import { resumeAsyncRound } from "./resume_async_round.ts"
import { ackOpenWebuiDelivery } from "./ack_openwebui_delivery.ts"
import { claimOpenWebuiDelivery } from "./claim_openwebui_delivery.ts"
import { retryOpenWebuiDelivery } from "./retry_openwebui_delivery.ts"
import { processChat } from "./process_chat.ts"
import { processLog } from "./process_log.ts"
import { publicGatewayFailure } from "./public_gateway_failure.ts"
import { structuredSelection } from "./structured_log_selection.ts"

export async function handleRequest(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname
  if (pathname.endsWith("/model-completions")) {
    if (!isCompletionAuthorized(request)) return new Response("unauthorized", { status: 401 })
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 })
    const input = parseCompletionCallback(await request.json().catch(() => null))
    if (!input) return Response.json({ error: "invalid_request" }, { status: 400 })
    const result = await resumeAsyncRound(input.call_id, input.provider_response_id)
    return Response.json({ ok: result.status === 200,
      disposition: result.disposition }, { status: result.status })
  }
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
  if (pathname.endsWith("/deliveries/claim")) {
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 })
    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      (body as Record<string, unknown>).consumer !== "openwebui-beta") {
      return Response.json({ error: "invalid_request" }, { status: 400 })
    }
    return Response.json({ ok: true, delivery: await claimOpenWebuiDelivery() })
  }
  if (pathname.endsWith("/deliveries/ack")) {
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 })
    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "invalid_request" }, { status: 400 })
    }
    const value = body as Record<string, unknown>
    const keys = Object.keys(value)
    if (keys.some((key) => ![
      "delivery_id", "capability_token", "disposition", "error_code",
    ].includes(key)) || typeof value.delivery_id !== "string" ||
      typeof value.capability_token !== "string") {
      return Response.json({ error: "invalid_request" }, { status: 400 })
    }
    const ok = value.disposition === "applied" || value.disposition === "duplicate"
      ? await ackOpenWebuiDelivery({ delivery_id: value.delivery_id,
        capability_token: value.capability_token, disposition: value.disposition })
      : typeof value.error_code === "string" && value.error_code.length <= 120
      ? await retryOpenWebuiDelivery({ delivery_id: value.delivery_id,
        capability_token: value.capability_token, error_code: value.error_code })
      : false
    return Response.json({ ok }, { status: ok ? 200 : 409 })
  }
  if (request.method === "HEAD" && pathname.endsWith("/log")) {
    return logReleaseResponse()
  }
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
