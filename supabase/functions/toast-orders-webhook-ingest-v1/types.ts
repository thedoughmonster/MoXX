import type { JSONValue } from "postgres"

export type ToastWebhookPayload = {
  guid: string
  timestamp: string
  [key: string]: JSONValue
}

export type StoreDisposition = "stored" | "duplicate"
