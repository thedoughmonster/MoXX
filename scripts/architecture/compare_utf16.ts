export function compareUtf16(left: string, right: string): number {
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index)
    if (difference !== 0) return difference < 0 ? -1 : 1
  }
  if (left.length === right.length) return 0
  return left.length < right.length ? -1 : 1
}
