export function readPublishableKey(rawValue?: string): string | null {
  const raw = rawValue ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")
  if (!raw) return null
  try {
    const keys = JSON.parse(raw) as Record<string, unknown>
    const value = keys.default
    return typeof value === "string" && value.length > 0 ? value : null
  } catch {
    return null
  }
}
