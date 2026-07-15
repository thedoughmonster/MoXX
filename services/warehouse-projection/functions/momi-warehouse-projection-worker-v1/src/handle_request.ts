import { parseDeliveryTrigger } from "./parse_request.ts"
import { processDelivery } from "./process_delivery.ts"
import { functionKey } from "./types.ts"
import { workerStore } from "./worker_store.ts"

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return Response.json({ ok: true, function_key: functionKey })
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
    return Response.json({ ok: false, function_key: functionKey,
      error: "invalid_request" }, { status: 400 })
  }
  const trigger = parseDeliveryTrigger(body)
  if (!trigger) {
    return Response.json({ ok: false, function_key: functionKey,
      error: "invalid_request" }, { status: 400 })
  }
  try {
    const result = await processDelivery(trigger, workerStore)
    return Response.json({ ok: result.outcome !== "failed",
      function_key: functionKey, ...result })
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    console.error("Warehouse projection delivery failed", {
      error_name: errorName,
    })
    return Response.json({ ok: false, function_key: functionKey,
      error: "worker_failed" }, { status: 500 })
  }
}
