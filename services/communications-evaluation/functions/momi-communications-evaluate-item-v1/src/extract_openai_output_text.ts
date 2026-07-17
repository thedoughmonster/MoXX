export function extractOpenAiOutputText(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const response = value as Record<string, unknown>
  if (typeof response.output_text === "string") return response.output_text
  if (!Array.isArray(response.output)) return null
  for (const output of response.output) {
    if (!output || typeof output !== "object" || Array.isArray(output)) continue
    const item = output as Record<string, unknown>
    if (!Array.isArray(item.content)) continue
    for (const content of item.content) {
      if (!content || typeof content !== "object" || Array.isArray(content)) continue
      const part = content as Record<string, unknown>
      if (part.type === "output_text" && typeof part.text === "string") {
        return part.text
      }
    }
  }
  return null
}
