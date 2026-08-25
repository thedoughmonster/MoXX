import type { RecoveryState } from "./recovery_types.ts"

export function recoveryGenerationCandidates(state: RecoveryState): readonly string[] {
  return [...new Set([state.generationSha256, state.attemptedGenerationSha256]
    .filter((value): value is string => typeof value === "string"))]
}
