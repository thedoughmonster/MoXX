import type { DeadmanPhaseHandoff } from "./deadman_phase_types.ts"

export function deriveDeadmanDeadline(handoff: DeadmanPhaseHandoff): number {
  if (handoff.status === "bootstrap_ambiguous_deadman_fallback_pending") {
    return handoff.bootstrapTerminalUtcMs + 35_000
  }
  if (handoff.lastObservedAtUtcMs !== null) return handoff.lastObservedAtUtcMs + 35_000
  const expiryUtcMs = Date.parse(handoff.guard.expiryUtc)
  if (!Number.isSafeInteger(expiryUtcMs)) throw new Error("Guard expiry is invalid")
  return expiryUtcMs + 5_000
}
