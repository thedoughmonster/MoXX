import type { ExecutionResult, WorkTriggerInput } from "./types.ts"

export const subscriptionKey = "order-alerting-v1"
export const liveOrderEventName = "warehouse.order.observed"

export type DeliveryTrigger = {
  event_id: string
  message_id: string
  capability_token: string
}

export type StagedEventWork = {
  disposition: "ignored_non_live_event"
  event_name: string
  work_id: null
  trigger_token: null
  work_status: null
} | {
  disposition: "ready"
  event_name: typeof liveOrderEventName
  work_id: string
  trigger_token: string
  work_status: "pending" | "running" | "succeeded" | "failed"
}

export type DeliveryFailure = "retry_wait" | "dead_letter" | "not_found"
export type DeliveryOutcome =
  | "processed"
  | "replay"
  | "duplicate"
  | "ignored_non_live_event"
  | "in_progress"
  | "retry_wait"
  | "dead_letter"
  | "failed"

export type DeliveryResult = {
  message_id: string
  event_id: string
  outcome: DeliveryOutcome
  error?: string
}

export type DeliveryWorkerStore = {
  beginDelivery: (
    eventId: string,
    messageId: string,
    capabilityToken: string,
  ) => Promise<boolean>
  stageEventWork: (
    trigger: DeliveryTrigger,
  ) => Promise<StagedEventWork | null>
  executeWork: (
    input: WorkTriggerInput,
    delivery: DeliveryTrigger,
  ) => Promise<ExecutionResult>
  acknowledgeDelivery: (
    eventId: string,
    messageId: string,
    capabilityToken: string,
  ) => Promise<boolean>
  failDelivery: (
    eventId: string,
    messageId: string,
    capabilityToken: string,
    error: string,
  ) => Promise<DeliveryFailure>
}
