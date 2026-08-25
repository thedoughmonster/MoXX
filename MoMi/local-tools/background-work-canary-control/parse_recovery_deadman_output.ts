import type { DeadmanReconciliationResult } from "./deadman_reconciliation_types.ts"
import { parseDeadmanReconciliationOutput } from "./parse_deadman_reconciliation_output.ts"
import { recoveryGenerationCandidates } from "./recovery_generation_candidates.ts"
import type { RecoveryState } from "./recovery_types.ts"

export function parseRecoveryDeadmanOutput(
  output: Uint8Array, state: RecoveryState,
  context: { mode: "known"; runId: string; guardJobId: number
    startCronRunId: number; workBaseline: { toastReady: number; routingReady: number
      deliveryReady: number; queueReady: number } },
): DeadmanReconciliationResult {
  for (const generationSha256 of recoveryGenerationCandidates(state)) {
    try { return parseDeadmanReconciliationOutput(output,
      { ...context, generationSha256 }, state.activation ? 11 : [0, 11]) } catch {
      /* one database transaction may have committed before its output failed */
    }
  }
  throw new Error("Recovery dead-man generation could not be reconciled")
}
