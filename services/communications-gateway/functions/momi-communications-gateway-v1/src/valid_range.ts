export function validRange(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const range = value as Record<string, unknown>
  return Object.keys(range).every((key) => ["start", "end"].includes(key)) &&
    Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end) &&
    (range.start as number) >= 0 && (range.end as number) > (range.start as number)
}
