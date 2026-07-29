import type { JsonValue } from "./types.ts"

export function parseJson(rawText: string): JsonValue | null {
  try {
    return JSON.parse(rawText) as JsonValue
  } catch {
    return null
  }
}
