import type { ProjectionWorkerSettings } from "./types.ts"

export function canContinueWorker(
  settings: ProjectionWorkerSettings,
  startedAtMs: number,
  nowMs: number,
  completedDeliveries: number,
): boolean {
  if (completedDeliveries >= settings.worker_max_deliveries) return false
  const deadlineMs = startedAtMs + settings.worker_max_runtime_seconds * 1000
  const requiredMs = (
    settings.handoff_reserve_seconds + settings.shutdown_margin_seconds
  ) * 1000
  return nowMs + requiredMs < deadlineMs
}
