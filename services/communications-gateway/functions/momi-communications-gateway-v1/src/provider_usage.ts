import type { JSONValue } from "postgres"

export function usage(body: Record<string, JSONValue>): Record<string, JSONValue> {
  return body.usage && typeof body.usage === "object" && !Array.isArray(body.usage)
    ? body.usage as Record<string, JSONValue> : {}
}
