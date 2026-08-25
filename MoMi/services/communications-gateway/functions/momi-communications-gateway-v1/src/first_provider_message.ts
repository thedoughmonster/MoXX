import type { JSONValue } from "postgres"

export function firstProviderMessage(body: Record<string, JSONValue>): JSONValue {
  const choice = Array.isArray(body.choices) ? body.choices[0] : null
  if (!choice || typeof choice !== "object" || Array.isArray(choice) ||
    choice instanceof Date) return null
  return (choice as Record<string, JSONValue>).message ?? null
}
