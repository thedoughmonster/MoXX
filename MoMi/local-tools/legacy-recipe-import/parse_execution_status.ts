export function parseExecutionStatus(output: string): string {
  const inspect = (value: unknown): string | undefined => {
    if (typeof value === "string") {
      const trimmed = value.trim()
      if (!trimmed) return undefined
      try {
        return inspect(JSON.parse(trimmed))
      } catch {
        const match = trimmed.match(
          /["']legacy_recipe_status["']\s*:\s*["']([a-z_]+)["']/,
        )
        return match?.[1]
      }
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const status = inspect(item)
        if (status) return status
      }
      return undefined
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>
      if (typeof record.legacy_recipe_status === "string") {
        return record.legacy_recipe_status
      }
      for (const item of Object.values(record)) {
        const status = inspect(item)
        if (status) return status
      }
    }
    return undefined
  }
  const status = inspect(output)
  if (!status) throw new Error("Database result omitted legacy recipe status")
  return status
}
