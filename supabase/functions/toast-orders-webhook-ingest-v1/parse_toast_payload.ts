import type { ToastWebhookPayload } from "./types.ts"

export function parseToastPayload(rawBody: string): ToastWebhookPayload | null {
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
      payload.timestamp.length === 0
    ) {
      return null
    }

    return payload as ToastWebhookPayload
  } catch {
    return null
  }
}
