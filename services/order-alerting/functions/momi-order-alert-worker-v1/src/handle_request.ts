import { parseDeliveryTrigger } from "./parse_delivery_trigger.ts"
import { parseWorkTrigger } from "./parse_request.ts"
import { processEventDelivery } from "./process_event_delivery.ts"
import { functionKey } from "./types.ts"
import type { DeliveryWorkerStore } from "./delivery_types.ts"

export async function handleRequest(
  request: Request,
  _connectionInfo?: unknown,
  testStore?: DeliveryWorkerStore,
): Promise<Response> {
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
  const work = parseWorkTrigger(body)
  const delivery = parseDeliveryTrigger(body)
  if (!work && !delivery) {
    return Response.json({ ok: false, function_key: functionKey,
      error: "invalid_request" }, { status: 400 })
  }
  try {
    if (work) {
      const { executeWork } = await import("./execute_work.ts")
      const result = await executeWork(work)
      return Response.json(result.body, { status: result.status })
    }
    const store = testStore ??
      (await import("./delivery_worker_store.ts")).deliveryWorkerStore
    const result = await processEventDelivery(delivery!, store)
    return Response.json({ ok: result.outcome !== "failed",
      function_key: functionKey, ...result })
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    console.error("Order alert worker failed", {
      work_id: work?.work_id,
      event_id: delivery?.event_id,
      error_name: errorName,
    })
    return Response.json({ ok: false, function_key: functionKey,
      error: "worker_failed" }, { status: 500 })
  }
}
