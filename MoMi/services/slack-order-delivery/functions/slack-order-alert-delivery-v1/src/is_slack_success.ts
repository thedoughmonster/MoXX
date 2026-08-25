import type { SlackTransportResult } from "./types.ts"

export function isSlackSuccess(response: SlackTransportResult): boolean {
  return response.status === 200 && response.is_json &&
    typeof response.body === "object" && response.body !== null &&
    !Array.isArray(response.body) &&
    (response.body as Record<string, unknown>).ok === true
}
