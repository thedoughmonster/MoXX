const maxRawEventId = 9223372036854775807n

export function parseRawEventId(input: unknown): string | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null
  }

  const rawEventId = (input as Record<string, unknown>).raw_event_id

  if (
    typeof rawEventId === "number" &&
    Number.isSafeInteger(rawEventId) &&
    rawEventId > 0
  ) {
    return String(rawEventId)
  }

  if (
    typeof rawEventId === "string" &&
    /^[1-9][0-9]*$/.test(rawEventId) &&
    BigInt(rawEventId) <= maxRawEventId
  ) {
    return rawEventId
  }

  return null
}
