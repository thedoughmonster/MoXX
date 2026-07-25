import type { JSONValue } from "postgres"

export function providerResponseId(body: Record<string, JSONValue>): string | null {
  return typeof body.id === "string" && body.id.length <= 240 ? body.id : null
}
