// service-owner: toast-stock-ingest

import type { ToastStockWebhookPayload } from "./types.ts"

const stockEventTypes = new Set(["in_stock", "low_quantity", "out_of_stock"])

export function parseToastStockPayload(
  rawBody: string,
): ToastStockWebhookPayload | null {
  try {
    const parsed: unknown = JSON.parse(rawBody)

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null
    }

    const payload = parsed as Record<string, unknown>

    if (
      typeof payload.guid !== "string" ||
      payload.guid.length === 0 ||
      typeof payload.timestamp !== "string" ||
      payload.timestamp.length === 0 ||
      !Number.isFinite(Date.parse(payload.timestamp)) ||
      payload.eventCategory !== "stock" ||
      typeof payload.eventType !== "string" ||
      !stockEventTypes.has(payload.eventType)
    ) {
      return null
    }

    return payload as ToastStockWebhookPayload
  } catch {
    return null
  }
}
