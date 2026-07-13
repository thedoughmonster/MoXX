import { isValidOrderModifier } from "./is_valid_order_modifier.ts"

export function isValidOrderItem(input: unknown): boolean {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false
  }
  const value = input as Record<string, unknown>
  return typeof value.name === "string" && value.name.length > 0 &&
    typeof value.quantity === "number" && Number.isFinite(value.quantity) &&
    value.quantity >= 0 && Array.isArray(value.modifiers) &&
    value.modifiers.every(isValidOrderModifier)
}
