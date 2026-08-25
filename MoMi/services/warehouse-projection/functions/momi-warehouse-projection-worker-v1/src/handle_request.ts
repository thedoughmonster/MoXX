import { canContinueWorker } from "./can_continue_worker.ts"
import { classifyProjectionOutcome } from "./classify_projection_outcome.ts"
import { parseDeliveryTrigger } from "./parse_request.ts"
import { processDelivery } from "./process_delivery.ts"
import { runBackgroundContinuation } from "./run_background_continuation.ts"
import { functionKey } from "./types.ts"
import { workerStore } from "./worker_store.ts"

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void
}

export async function handleRequest(request: Request): Promise<Response> {
  const invocationStartedAtMs = Date.now()
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
    if (classifyProjectionOutcome(result.outcome)) {
      try {
        const settings = await workerStore.readWorkerSettings()
        if (canContinueWorker(
          settings, invocationStartedAtMs, Date.now(), 1,
        )) {
          const next = await workerStore.reserveNextDelivery()
          if (next) EdgeRuntime.waitUntil(runBackgroundContinuation({
            trigger: next,
            settings,
            started_at_ms: invocationStartedAtMs,
            completed_deliveries: 1,
          }, workerStore))
        }
      } catch (error) {
        console.error("projection background handoff could not start", error)
      }
    }
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
