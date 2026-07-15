import { classifyProjectionOutcome } from "./classify_projection_outcome.ts"
import type {
  DeliveryResult,
  DeliveryTrigger,
  WorkerStore,
} from "./types.ts"

export async function processDelivery(
  trigger: DeliveryTrigger,
  store: WorkerStore,
): Promise<DeliveryResult> {
  try {
    const begun = await store.beginDelivery(
      trigger.event_id, trigger.message_id, trigger.capability_token,
    )
    if (!begun) {
      return { message_id: trigger.message_id, event_id: trigger.event_id,
        outcome: "duplicate" }
    }
    const sourceEvent = await store.readSourceEvent(trigger.event_id)
    if (!sourceEvent) throw new Error("source_event_not_found")
    if (sourceEvent.event_id !== trigger.event_id ||
        sourceEvent.source_system !== "toast" ||
        !sourceEvent.event_name.startsWith("source.toast.")) {
      throw new Error("source_event_mismatch")
    }
    const projection = classifyProjectionOutcome(
      await store.projectToastEvent(trigger.event_id),
    )
    if (!projection) throw new Error("unexpected_projection_outcome")
    const acknowledged = await store.acknowledgeDelivery(
      trigger.event_id, trigger.message_id, trigger.capability_token,
    )
    if (!acknowledged) throw new Error("acknowledgement_failed")
    try {
      await store.wakeNextDelivery()
    } catch (error) {
      console.error("next projection delivery could not be woken", error)
    }
    return { message_id: trigger.message_id, event_id: trigger.event_id,
      outcome: projection }
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    const errorMessage = error instanceof Error
      ? error.message
      : "unknown_projection_failure"
    const errorCode = /^[a-z0-9_]+$/.test(errorMessage)
      ? errorMessage
      : "projection_failed"
    const failure = await store.failDelivery(
      trigger.event_id, trigger.message_id, trigger.capability_token,
      `${errorName}: ${errorMessage}`,
    )
    return { message_id: trigger.message_id, event_id: trigger.event_id,
      outcome: failure === "not_found" ? "failed" : failure,
      error: errorCode }
  }
}
