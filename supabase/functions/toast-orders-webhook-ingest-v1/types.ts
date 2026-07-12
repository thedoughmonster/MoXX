export type ToastWebhookPayload = {
  guid: string
  timestamp: string
  [key: string]: unknown
}

export type StoreDisposition = "stored" | "duplicate"

export type StoreResult = {
  disposition: StoreDisposition
  rawEventId: string
}
