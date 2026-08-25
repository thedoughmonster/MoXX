export function isValidOrderModifier(input: unknown): boolean {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false
  }
  const value = input as Record<string, unknown>
  return typeof value.name === "string" && value.name.length > 0 &&
    typeof value.quantity === "number" && Number.isFinite(value.quantity) &&
    value.quantity >= 0 && Number.isInteger(value.depth) &&
    Number(value.depth) >= 1
}
