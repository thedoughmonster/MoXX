export function validateNonnegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) ||
    !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative safe integer`)
  }
  return value
}
