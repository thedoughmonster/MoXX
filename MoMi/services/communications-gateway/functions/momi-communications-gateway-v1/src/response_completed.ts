import type { JSONValue } from "postgres"

export function responseCompleted(body: Record<string, JSONValue>): boolean {
  return body.status === "completed"
}
