import type { JSONValue } from "postgres"

export function responseItems(body: Record<string, JSONValue>): JSONValue[] {
  return Array.isArray(body.output) ? [...body.output] : []
}
