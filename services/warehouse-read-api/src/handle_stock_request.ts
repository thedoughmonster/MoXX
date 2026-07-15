import { parseStockRead } from "./parse_stock_read.ts"
import { readStock } from "./read_stock.ts"
import { contractVersion, type StockReadContract } from "./types.ts"

export async function handleStockRequest(
  request: Request,
  contract: StockReadContract,
): Promise<Response> {
  const traceId = crypto.randomUUID()
  if (request.method === "GET") {
    return Response.json({ ok: true, function_key: contract.functionKey,
      contract_version: contractVersion, trace_id: traceId })
  }
  if (request.method !== "POST") {
    return new Response("method not allowed", {
      status: 405, headers: { Allow: "GET, POST" },
    })
  }
  let body: unknown
  try { body = await request.json() } catch { body = null }
  const input = parseStockRead(body)
  const base = { contract_key: contract.functionKey,
    contract_version: contractVersion, trace_id: traceId }
  if (!input) {
    return Response.json({ ok: false, ...base,
      error: "invalid_request" }, { status: 400 })
  }
  try {
    const row = await readStock(input, contract)
    if (!row.work_id) return Response.json({ ok: false, ...base,
      error: "forbidden" }, { status: 403 })
    if (!row.contract_active) return Response.json({ ok: false, ...base,
      work_id: input.work_id, error: "contract_inactive" }, { status: 503 })
    if (!row.item_id || !row.location_id || !row.observed_at ||
      !row.stock_state || !row.provenance || !row.freshness) {
      return Response.json({ ok: false, ...base, work_id: input.work_id,
        error: "observation_not_found" }, { status: 404 })
    }
    const document = { item_id: row.item_id, location_id: row.location_id,
      observed_at: row.observed_at, stock_state: row.stock_state,
      quantity: row.quantity }
    return Response.json({ ok: true, ...base, work_id: input.work_id,
      item_id: row.item_id, location_id: row.location_id,
      schema_version: 1, document, provenance: row.provenance,
      freshness: row.freshness })
  } catch {
    return Response.json({ ok: false, ...base, work_id: input.work_id,
      error: "read_failed" }, { status: 500 })
  }
}
