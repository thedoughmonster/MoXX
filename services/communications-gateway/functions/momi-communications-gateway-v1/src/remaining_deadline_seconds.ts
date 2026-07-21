export function remainingDeadlineSeconds(deadline: string, now = Date.now()): number {
  const remaining = Math.floor((Date.parse(deadline) - now) / 1000)
  if (!Number.isFinite(remaining) || remaining < 1) {
    throw new Error("invocation_deadline_exceeded")
  }
  return remaining
}
