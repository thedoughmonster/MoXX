import type { JsonRecord } from "./types.ts"

export function parseRawPayload(rawBody: Uint8Array): {
  rawText: string
  payload: JsonRecord
} | null {
  try {
    const rawText = new TextDecoder("utf-8", { fatal: true }).decode(rawBody)
    const value = JSON.parse(rawText)
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    return { rawText, payload: value as JsonRecord }
  } catch {
    return null
  }
}
