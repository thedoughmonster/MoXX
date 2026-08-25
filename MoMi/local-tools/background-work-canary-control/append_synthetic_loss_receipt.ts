import type { DeadmanPhaseDependencies,
  DeadmanPhaseHandoff } from "./deadman_phase_types.ts"

export async function appendSyntheticLossReceipt(
  handoff: DeadmanPhaseHandoff,
  dependencies: Pick<DeadmanPhaseDependencies, "appendReceipt" | "clock">,
): Promise<boolean> {
  if (handoff.receipt.poisoned) return false
  try {
    await dependencies.appendReceipt(handoff.receipt, {
      event_type: "stop_requested",
      timestamp_utc: new Date(dependencies.clock.nowUtcMs()).toISOString(),
      metrics: { status: "stopped" },
    })
    return true
  } catch {
    return false
  }
}
