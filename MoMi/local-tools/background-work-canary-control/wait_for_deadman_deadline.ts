import { MAX_LAUNCH_LATENESS_MS } from "./schedule_constants.ts"
import type { DeadmanPhaseDependencies,
  DeadmanWaitResult } from "./deadman_phase_types.ts"

export async function waitForDeadmanDeadline(
  deadlineUtcMs: number,
  dependencies: Pick<DeadmanPhaseDependencies,
    "clock" | "monotonicNowMs" | "timer">,
  signal?: AbortSignal,
  holderLossSignal?: AbortSignal,
): Promise<DeadmanWaitResult> {
  const startUtcMs = dependencies.clock.nowUtcMs()
  const startMonotonicMs = dependencies.monotonicNowMs()
  let cancellationObserved = signal?.aborted ?? false
  let holderLossObserved = holderLossSignal?.aborted ?? false
  const observeCancellation = () => { cancellationObserved = true }
  const observeHolderLoss = () => { holderLossObserved = true }
  signal?.addEventListener("abort", observeCancellation, { once: true })
  holderLossSignal?.addEventListener("abort", observeHolderLoss, { once: true })
  if (!Number.isSafeInteger(deadlineUtcMs) || deadlineUtcMs < 0 ||
    !Number.isFinite(startMonotonicMs) || startUtcMs > deadlineUtcMs) {
    signal?.removeEventListener("abort", observeCancellation)
    holderLossSignal?.removeEventListener("abort", observeHolderLoss)
    return { status: "late_or_missed", scheduledAtUtcMs: deadlineUtcMs,
      launchedAtUtcMs: startUtcMs, cancellationObserved, holderLossObserved }
  }
  if (startUtcMs < deadlineUtcMs) {
    try {
      await new Promise<void>((resolve) => dependencies.timer.setAt(deadlineUtcMs, resolve))
    } catch {
      signal?.removeEventListener("abort", observeCancellation)
      holderLossSignal?.removeEventListener("abort", observeHolderLoss)
      return { status: "late_or_missed", scheduledAtUtcMs: deadlineUtcMs,
        launchedAtUtcMs: dependencies.clock.nowUtcMs(), cancellationObserved,
        holderLossObserved }
    }
  }
  const launchedAtUtcMs = dependencies.clock.nowUtcMs()
  const monotonicElapsed = dependencies.monotonicNowMs() - startMonotonicMs
  const expectedElapsed = deadlineUtcMs - startUtcMs
  signal?.removeEventListener("abort", observeCancellation)
  holderLossSignal?.removeEventListener("abort", observeHolderLoss)
  if (launchedAtUtcMs < deadlineUtcMs ||
    launchedAtUtcMs - deadlineUtcMs > MAX_LAUNCH_LATENESS_MS ||
    monotonicElapsed < expectedElapsed ||
    monotonicElapsed - expectedElapsed > MAX_LAUNCH_LATENESS_MS) {
    return { status: "late_or_missed", scheduledAtUtcMs: deadlineUtcMs,
      launchedAtUtcMs, cancellationObserved, holderLossObserved }
  }
  return { status: "deadline_reached", scheduledAtUtcMs: deadlineUtcMs,
    launchedAtUtcMs, cancellationObserved, holderLossObserved }
}
