export type SampleBoundary = {
  index: number
  offsetSeconds: number
  scheduledAtUtcMs: number
  fast: true
  resource: boolean
}

export type SchedulerStopReason =
  | "cancelled"
  | "evaluate_deadline_exceeded"
  | "launch_lateness_exceeded"
  | "missing_boundary"
  | "parse_deadline_exceeded"
  | "provider_deadline_exceeded"
  | "receipt_deadline_exceeded"
  | "sample_lifecycle_failed"
  | "sample_overlap"
  | "sample_stage_order_invalid"

export type SchedulerResult =
  | { status: "completed" }
  | { status: "stopped"; reason: SchedulerStopReason }

export type SchedulerClock = { nowUtcMs: () => number }
export type SchedulerTimer = {
  setAt: (utcMs: number, task: () => void) => () => void
}

export type SampleLifecycle = {
  providerComplete: () => void
  parseComplete: () => void
  evaluateComplete: () => void
  receiptComplete: () => void
  stopAfterReceipt: () => void
  fail: () => void
}

export type SchedulerDependencies = {
  clock: SchedulerClock
  timer: SchedulerTimer
  launch: (boundary: SampleBoundary, lifecycle: SampleLifecycle) => void
  signal?: AbortSignal
  onStop?: (reason: SchedulerStopReason) => void
}
