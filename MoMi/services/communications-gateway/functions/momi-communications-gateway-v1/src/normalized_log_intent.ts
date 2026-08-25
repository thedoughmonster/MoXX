export function normalizedLogIntent(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, " ").replace(/[.!?]+$/gu, "")
}
