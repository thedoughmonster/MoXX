import type { DeadmanPhaseDependencies,
  DeadmanPhaseHandoff } from "./deadman_phase_types.ts"

export async function appendCleanupReceipt(
  handoff: DeadmanPhaseHandoff,
  dependencies: Pick<DeadmanPhaseDependencies, "appendReceipt" | "clock">,
): Promise<boolean> {
  if (handoff.receipt.poisoned) return false
  try {
    await dependencies.appendReceipt(handoff.receipt, {
      event_type: "cleanup_completed",
      timestamp_utc: new Date(dependencies.clock.nowUtcMs()).toISOString(),
      metrics: { status: "completed", guard: { active: false, count: 0 } },
    })
    return true
  } catch {
    return false
  }
}
