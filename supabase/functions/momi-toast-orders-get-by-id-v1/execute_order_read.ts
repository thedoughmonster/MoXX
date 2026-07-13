import {
  contractVersion,
  functionKey,
  type ExecutionResult,
  type OrderReader,
  type OrderReadInput,
} from "./types.ts"

export async function executeOrderRead(
  input: OrderReadInput,
  traceId: string,
  reader: OrderReader,
): Promise<ExecutionResult> {
  const result = await reader(input)
  const identity = {
    contract_key: functionKey,
    contract_version: contractVersion,
    trace_id: traceId,
    work_id: input.work_id,
  }

  if (result.disposition === "forbidden") {
    return {
      status: 403,
      body: { ok: false, ...identity, error: "forbidden" },
    }
  }
  if (result.disposition === "contract_inactive") {
    return {
      status: 503,
      body: { ok: false, ...identity, error: "contract_inactive" },
    }
  }
  if (result.disposition === "order_not_found") {
    return {
      status: 404,
      body: { ok: false, ...identity, error: "order_not_found" },
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      ...identity,
      work_source_version_id: result.work_source_version_id,
      source_system: result.order.source_system,
      source_version_id: result.order.source_version_id,
      order_id: result.order.order_id,
      location_id: result.order.location_id,
      retrieved_at: result.order.retrieved_at,
      content_hash: result.order.content_hash,
      payload: result.order.payload,
    },
  }
}
