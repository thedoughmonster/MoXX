import type {
  DeliveryResult,
  DeliveryTrigger,
  DeliveryWorkerStore,
} from "./delivery_types.ts"

export async function processEventDelivery(
  trigger: DeliveryTrigger,
  store: DeliveryWorkerStore,
): Promise<DeliveryResult> {
  try {
    const begun = await store.beginDelivery(
      trigger.event_id, trigger.message_id, trigger.capability_token,
    )
    if (!begun) return { message_id: trigger.message_id,
      event_id: trigger.event_id, outcome: "duplicate" }
    const staged = await store.stageEventWork(trigger)
    if (!staged) throw new Error("event_reference_mismatch")
    if (staged.disposition === "ignored_non_live_event") {
      const acknowledged = await store.acknowledgeDelivery(
        trigger.event_id, trigger.message_id, trigger.capability_token,
      )
      if (!acknowledged) throw new Error("acknowledgement_failed")
      return { message_id: trigger.message_id, event_id: trigger.event_id,
        outcome: "ignored_non_live_event" }
    }
    if (staged.work_status === "succeeded") {
      const acknowledged = await store.acknowledgeDelivery(
        trigger.event_id, trigger.message_id, trigger.capability_token,
      )
      if (!acknowledged) throw new Error("acknowledgement_failed")
      return { message_id: trigger.message_id, event_id: trigger.event_id,
        outcome: "replay" }
    }
    const execution = await store.executeWork({ work_id: staged.work_id,
      trigger_token: staged.trigger_token }, trigger)
    if (execution.status === 409) return { message_id: trigger.message_id,
      event_id: trigger.event_id, outcome: "in_progress" }
    if (execution.status !== 200 || execution.body.ok !== true) {
      throw new Error(String(execution.body.error ?? "alert_work_failed"))
    }
    const acknowledged = await store.acknowledgeDelivery(
      trigger.event_id, trigger.message_id, trigger.capability_token,
    )
    if (!acknowledged) throw new Error("acknowledgement_failed")
    return { message_id: trigger.message_id, event_id: trigger.event_id,
      outcome: "processed" }
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    const errorMessage = error instanceof Error ? error.message : "unknown"
    const failure = await store.failDelivery(
      trigger.event_id, trigger.message_id, trigger.capability_token,
      `${errorName}: ${errorMessage}`,
    )
    return { message_id: trigger.message_id, event_id: trigger.event_id,
      outcome: failure === "not_found" ? "failed" : failure,
      error: /^[a-z0-9_]+$/.test(errorMessage)
        ? errorMessage : "order_alert_event_failed" }
  }
}
