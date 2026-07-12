import { executeOrderRead } from "./execute_order_read.ts"
import { parseOrderReadRequest } from "./parse_request.ts"
import { readOrder } from "./read_order.ts"
import { contractVersion, functionKey } from "./types.ts"

export async function handleRequest(request: Request): Promise<Response> {
  const traceId = crypto.randomUUID()
  if (request.method === "GET") {
    return Response.json({
      ok: true,
      function_key: functionKey,
      contract_version: contractVersion,
      trace_id: traceId,
    })
  }
  if (request.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
      headers: { Allow: "GET, POST" },
    })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      {
        ok: false,
        contract_key: functionKey,
        contract_version: contractVersion,
        trace_id: traceId,
        error: "invalid_request",
      },
      { status: 400 },
    )
  }

  const input = parseOrderReadRequest(body)
  if (!input) {
    return Response.json(
      {
        ok: false,
        contract_key: functionKey,
        contract_version: contractVersion,
        trace_id: traceId,
        error: "invalid_request",
      },
      { status: 400 },
    )
  }

  try {
    const result = await executeOrderRead(input, traceId, readOrder)
    return Response.json(result.body, { status: result.status })
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    console.error("MoMi order read failed", {
      trace_id: traceId,
      work_id: input.work_id,
      error_name: errorName,
    })
    return Response.json(
      {
        ok: false,
        contract_key: functionKey,
        contract_version: contractVersion,
        trace_id: traceId,
        work_id: input.work_id,
        error: "read_failed",
      },
      { status: 500 },
    )
  }
}
