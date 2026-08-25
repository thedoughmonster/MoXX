import type { ParsedSlackBody } from "./types.ts"

export function parseSlackBody(rawBody: string): ParsedSlackBody {
  try {
    return { body: JSON.parse(rawBody), is_json: true }
  } catch {
    return { body: null, is_json: false }
  }
}
