export const functionKey = "momi.warehouse_projection.toast.consume.v1"
export const subscriptionKey = "warehouse-projection-toast-v1"

export type DeliveryTrigger = {
  event_id: string
  message_id: string
  capability_token: string
}

export type SourceEvent = {
  event_id: string
  event_name: string
  source_system: string | null
  entity_type: string | null
  entity_id: string | null
  occurred_at: string
  schema_version: number
  source_reference: Record<string, unknown>
  correlation_id: string
}

export type ProjectionOutcome =
  | "projected"
  | `projected_${string}`
  | "acquisition_enqueued"
  | "acquisition_already_enqueued"
  | "menu_refresh_enqueued"
  | "publication_not_advanced"
  | `ignored_${string}`

export type DeliveryFailure = "retry_wait" | "dead_letter" | "not_found"
export type DeliveryOutcome =
  | ProjectionOutcome
  | "duplicate"
  | "retry_wait"
  | "dead_letter"
  | "failed"

export type DeliveryResult = {
  message_id: string
  event_id: string
  outcome: DeliveryOutcome
  error?: string
}

export type WorkerStore = {
  beginDelivery: (
    eventId: string,
    messageId: string,
    capabilityToken: string,
  ) => Promise<boolean>
  readSourceEvent: (eventId: string) => Promise<SourceEvent | null>
  projectAndAcknowledgeDelivery: (
    eventId: string,
    messageId: string,
    capabilityToken: string,
  ) => Promise<unknown>
  failDelivery: (
    eventId: string,
    messageId: string,
    capabilityToken: string,
    error: string,
  ) => Promise<DeliveryFailure>
  wakeNextDelivery: () => Promise<boolean>
}
