export function waitForRecoveryBoundary(
  utcMs: number, signal: AbortSignal, nowUtcMs: () => number = Date.now,
): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false)
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: boolean) => {
      if (settled) return
      settled = true
      signal.removeEventListener("abort", abort)
      clearTimeout(timer)
      resolve(value)
    }
    const abort = () => finish(false)
    const timer = setTimeout(() => finish(true), Math.max(0, utcMs - nowUtcMs()))
    signal.addEventListener("abort", abort, { once: true })
  })
}
