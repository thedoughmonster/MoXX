import type { JSONValue } from "postgres"

export type ToastStockWebhookPayload = {
  guid: string
  timestamp: string
  eventCategory: "stock"
  eventType: "in_stock" | "low_quantity" | "out_of_stock"
  [key: string]: JSONValue
}

export type StoreDisposition = "stored" | "duplicate"
