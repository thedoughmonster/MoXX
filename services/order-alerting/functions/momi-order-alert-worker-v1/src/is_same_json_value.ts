export function isSameJsonValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) ||
      left.length !== right.length) return false
    for (let index = 0; index < left.length; index += 1) {
      if (!isSameJsonValue(left[index], right[index])) return false
    }
    return true
  }
  if (typeof left !== "object" || left === null ||
    typeof right !== "object" || right === null) return false
  const leftValue = left as Record<string, unknown>
  const rightValue = right as Record<string, unknown>
  const leftKeys = Object.keys(leftValue)
  if (leftKeys.length !== Object.keys(rightValue).length) return false
  for (const key of leftKeys) {
    if (!Object.hasOwn(rightValue, key) ||
      !isSameJsonValue(leftValue[key], rightValue[key])) return false
  }
  return true
}
