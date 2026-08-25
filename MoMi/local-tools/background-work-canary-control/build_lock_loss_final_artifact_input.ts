import type { FinalArtifactInput } from "./final_artifact_types.ts"

export function buildLockLossFinalArtifactInput(
  input: FinalArtifactInput,
  terminalAtUtc: string,
): FinalArtifactInput {
  return {
    ...input,
    status: "manual_reconciliation_required",
    reason: "lifecycle_lock_lost",
    terminalAtUtc,
  }
}
