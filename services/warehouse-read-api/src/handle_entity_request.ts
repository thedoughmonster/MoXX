import { parseEntityRead } from "./parse_entity_read.ts"
import { readEntity } from "./read_entity.ts"
import { contractVersion, type EntityReadContract } from "./types.ts"

export async function handleEntityRequest(
  request: Request,
  contract: EntityReadContract,
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
  const input = parseEntityRead(body)
  const base = { contract_key: contract.functionKey,
    contract_version: contractVersion, trace_id: traceId }
  if (!input) {
    return Response.json({ ok: false, ...base,
      error: "invalid_request" }, { status: 400 })
  }
  try {
    const row = await readEntity(input, contract)
    if (!row.work_id) return Response.json({ ok: false, ...base,
      error: "forbidden" }, { status: 403 })
    if (!row.contract_active) return Response.json({ ok: false, ...base,
      work_id: input.work_id, error: "contract_inactive" }, { status: 503 })
    const acceptedTypes = contract.storedEntityTypes ?? [contract.entityType]
    if (!row.entity_id || !row.entity_type ||
      !acceptedTypes.includes(row.entity_type) ||
      row.schema_version === null || row.schema_version < 1 ||
      !row.canonical_document || !row.provenance || !row.freshness) {
      return Response.json({ ok: false, ...base, work_id: input.work_id,
        error: "entity_not_found" }, { status: 404 })
    }
    return Response.json({ ok: true, ...base, work_id: input.work_id,
      entity_id: row.entity_id, entity_type: contract.entityType,
      schema_version: row.schema_version, document: row.canonical_document,
      provenance: row.provenance, freshness: row.freshness })
  } catch {
    return Response.json({ ok: false, ...base, work_id: input.work_id,
      error: "read_failed" }, { status: 500 })
  }
}
