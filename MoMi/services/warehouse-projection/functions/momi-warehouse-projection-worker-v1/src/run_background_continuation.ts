import { canContinueWorker } from "./can_continue_worker.ts"
import { classifyProjectionOutcome } from "./classify_projection_outcome.ts"
import { processDelivery } from "./process_delivery.ts"
import type {
  DeliveryTrigger,
  ProjectionContinuation,
  WorkerStore,
} from "./types.ts"

export async function runBackgroundContinuation(
  continuation: ProjectionContinuation,
  store: WorkerStore,
): Promise<void> {
  const backgroundStartedAtMs = Date.now()
  let current: DeliveryTrigger | null = continuation.trigger
  let completed = continuation.completed_deliveries
  try {
    while (current) {
      const result = await processDelivery(current, store)
      completed += 1
      if (!classifyProjectionOutcome(result.outcome)) break
      if (!canContinueWorker(
        continuation.settings,
        continuation.started_at_ms,
        Date.now(),
        completed,
      )) break
      current = await store.reserveNextDelivery()
    }
    console.info("Warehouse projection continuation finished", {
      completed_deliveries: completed,
      elapsed_ms: Date.now() - backgroundStartedAtMs,
    })
  } catch (error) {
    console.error("Warehouse projection continuation stopped", {
      event_id: current?.event_id ?? null,
      completed_deliveries: completed,
      elapsed_ms: Date.now() - backgroundStartedAtMs,
      error_name: error instanceof Error ? error.name : "UnknownError",
    })
  }
}
