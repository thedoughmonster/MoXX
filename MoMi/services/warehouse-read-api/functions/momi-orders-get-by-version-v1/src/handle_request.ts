import { parseOrderVersionRead } from "./parse_request.ts"
import { readOrderVersion } from "./read_order.ts"
import { contractVersion, functionKey } from "./types.ts"

export async function handleRequest(request: Request): Promise<Response> {
  const traceId = crypto.randomUUID()
  if (request.method === "GET") {
    return Response.json({ ok: true, function_key: functionKey,
      contract_version: contractVersion, trace_id: traceId })
  }
  if (request.method !== "POST") {
    return new Response("method not allowed", {
      status: 405, headers: { Allow: "GET, POST" },
    })
  }
  let body: unknown
  try { body = await request.json() } catch { body = null }
  const input = parseOrderVersionRead(body)
  const base = { contract_key: functionKey,
    contract_version: contractVersion, trace_id: traceId }
  if (!input) {
    return Response.json({ ok: false, ...base,
      error: "invalid_request" }, { status: 400 })
  }
  try {
    const row = await readOrderVersion(input)
    if (!row.work_id) return Response.json({ ok: false, ...base,
      error: "forbidden" }, { status: 403 })
    if (!row.contract_active) return Response.json({ ok: false, ...base,
      work_id: input.work_id, error: "contract_inactive" }, { status: 503 })
    if (!row.order_id || !row.order_version_id || !row.order_document ||
      !row.order_presentation || !row.provenance || !row.freshness ||
      !row.schema_version) {
      return Response.json({ ok: false, ...base,
        work_id: input.work_id, error: "order_not_found" }, { status: 404 })
    }
    return Response.json({ ok: true, ...base, work_id: input.work_id,
      order_id: row.order_id, order_version_id: row.order_version_id,
      schema_version: row.schema_version, order_document: row.order_document,
      order_presentation: row.order_presentation,
      provenance: row.provenance, freshness: row.freshness })
  } catch {
    return Response.json({ ok: false, ...base, work_id: input.work_id,
      error: "read_failed" }, { status: 500 })
  }
}
