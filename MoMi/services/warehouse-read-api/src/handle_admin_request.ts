import { adminAuthorized } from "./admin_authorized.ts"

export async function handleAdminRequest(request: Request, dependencies: {
  token: string | undefined
  read: () => Promise<unknown | null>
}): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" }
  const url = new URL(request.url)
  if (request.method !== "GET") return Response.json(
    { error: "method_not_allowed" }, { status: 405,
      headers: { ...headers, Allow: "GET" } })
  if (/^\/(?:functions\/v1\/)?momi-admin-data-v1\/?$/.test(url.pathname)) {
    return Response.json({ ok: true, contract: "momi.admin.sales_health.v1" },
      { headers })
  }
  if (!/^\/(?:functions\/v1\/)?momi-admin-data-v1\/sales\/health$/
    .test(url.pathname)) return Response.json(
      { error: "not_found" }, { status: 404, headers })
  if (url.search || request.body !== null) return Response.json(
    { error: "invalid_request" }, { status: 400, headers })
  if (!dependencies.token) return Response.json(
    { error: "not_configured" }, { status: 503, headers })
  if (!await adminAuthorized(request.headers.get("authorization"),
    dependencies.token)) return Response.json(
      { error: "unauthorized" }, { status: 401, headers })
  try {
    const data = await dependencies.read()
    if (data === null) return Response.json({ error: "read_unavailable" },
      { status: 503, headers: { ...headers, "Retry-After": "60" } })
    const body = JSON.stringify(data)
    if (!body || new TextEncoder().encode(body).byteLength > 2_000_000) {
      return Response.json({ error: "read_unavailable" },
        { status: 503, headers })
    }
    return new Response(body, {
      headers: { ...headers, "Content-Type": "application/json" },
    })
  } catch {
    return Response.json({ error: "read_unavailable" }, { status: 503, headers })
  }
}
