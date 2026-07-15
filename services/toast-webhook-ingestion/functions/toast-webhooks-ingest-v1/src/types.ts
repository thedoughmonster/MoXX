// service-owner: toast-webhook-ingestion

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type ToastWebhookPayload = {
  [key: string]: JsonValue
  guid: string
  timestamp: string
  eventCategory: string
  eventType: string
  details: { [key: string]: JsonValue }
}

export type SubscriptionKey =
  | "orders"
  | "stock"
  | "menus"
  | "packaging"
  | "restaurant-availability"
  | "ordering-schedule"

export type WebhookContract = {
  subscriptionKey: SubscriptionKey
  secretName: string
}

export type WebhookEnvelope = {
  eventGuid: string
  subscriptionKey: SubscriptionKey
  eventCategory: string
  eventType: string
  restaurantGuid: string | null
  correlationId: string
  sourceOccurredAt: string
  payload: ToastWebhookPayload
  rawBody: string
  contentHash: string
  handlerVersion: string
}

export type StoreDisposition = "stored" | "duplicate"

export type Database = {
  (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Record<string, unknown>[]>
  json(value: unknown): unknown
}

export type IngestionDependencies = {
  getSecret(secretName: string): string | undefined
  createCorrelationId(): string
  store(envelope: WebhookEnvelope): Promise<StoreDisposition>
}
