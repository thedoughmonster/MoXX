import type { JSONValue } from "postgres"

export type LogReceipt = {
  disposition: "stored" | "duplicate"
  selection_id: string
  shop_log_id: string
}

export function logReceipt(value: JSONValue): LogReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || value instanceof Date) return null
  const receipt = value as Record<string, JSONValue>
  if (!["stored", "duplicate"].includes(String(receipt.disposition))
    || typeof receipt.selection_id !== "string" || !receipt.selection_id
    || typeof receipt.shop_log_id !== "string" || !receipt.shop_log_id) return null
  return receipt as LogReceipt
}
