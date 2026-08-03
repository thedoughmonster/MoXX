import type { RecoveryObservation, RecoveryState } from "./recovery_types.ts"

export function hasRecoveryMembershipDrift(
  sample: RecoveryObservation,
  state: Pick<RecoveryState, "lastMembershipCount" | "lastMembershipSha256" |
    "lastLineageEdgeCount" | "lastLineageEdgeSha256">,
): boolean {
  return sample.cohortMembershipCount < state.lastMembershipCount ||
    (sample.cohortMembershipCount === state.lastMembershipCount &&
      sample.cohortMembershipSha256 !== state.lastMembershipSha256) ||
    sample.cohortLineageEdgeCount < state.lastLineageEdgeCount ||
    (sample.cohortLineageEdgeCount === state.lastLineageEdgeCount &&
      sample.cohortLineageEdgeSha256 !== state.lastLineageEdgeSha256)
}
