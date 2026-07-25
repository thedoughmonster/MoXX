export function extractGatewayOutput(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const response = value as Record<string, unknown>
  if (typeof response.output_text === "string") return response.output_text
  if (!Array.isArray(response.output)) return null
  const parts: string[] = []
  for (const item of response.output) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const content = (item as Record<string, unknown>).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== "object" || Array.isArray(part)) continue
      const record = part as Record<string, unknown>
      if (record.type === "output_text" && typeof record.text === "string") {
        parts.push(record.text)
      }
    }
  }
  return parts.length ? parts.join("") : null
}
