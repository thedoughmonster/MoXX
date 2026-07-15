import type { ToastWebhookPayload } from "./types.ts"

export function parseToastWebhook(rawBody: string): ToastWebhookPayload | null {
  try {
    const parsed: unknown = JSON.parse(rawBody)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null
    }

    const payload = parsed as Record<string, unknown>
    const details = payload.details
    if (
      typeof payload.guid !== "string" || payload.guid.length === 0 ||
      typeof payload.timestamp !== "string" || payload.timestamp.length === 0 ||
      typeof payload.eventCategory !== "string" ||
      payload.eventCategory.length === 0 ||
      typeof payload.eventType !== "string" || payload.eventType.length === 0 ||
      typeof details !== "object" || details === null || Array.isArray(details)
    ) {
      return null
    }

    return payload as ToastWebhookPayload
  } catch {
    return null
  }
}
