import type { JSONValue } from "postgres"

export function parseSourceBody(rawBody: string): JSONValue {
  if (!rawBody) {
    return null
  }

  try {
    return JSON.parse(rawBody) as JSONValue
  } catch {
    return rawBody
  }
}
