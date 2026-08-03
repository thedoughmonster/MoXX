export function validateDeadmanActiveMasks(value: number | readonly number[]): readonly number[] {
  const masks = Array.isArray(value) ? value : [value]
  if (masks.length < 1 || masks.some((mask) =>
    !Number.isSafeInteger(mask) || mask < 0 || mask > 15)) {
    throw new Error("Expected dead-man active mask is invalid")
  }
  return masks
}
