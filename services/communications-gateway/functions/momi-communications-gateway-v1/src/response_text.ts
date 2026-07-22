import type { JSONValue } from "postgres"
import { responseItems } from "./response_items.ts"

export function responseText(body: Record<string, JSONValue>): string {
  const parts: string[] = []
  for (const item of responseItems(body)) {
    if (!item || typeof item !== "object" || Array.isArray(item) || item instanceof Date) continue
    const content = (item as Record<string, JSONValue>).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== "object" || Array.isArray(part) || part instanceof Date) continue
      const value = part as Record<string, JSONValue>
      if (value.type === "output_text" && typeof value.text === "string") parts.push(value.text)
    }
  }
  return parts.join("")
}
