import { appendFinalArtifactFailure } from "./append_final_artifact_failure.ts"
import { appendFinalizationLockLoss } from "./append_finalization_lock_loss.ts"
import { buildLockLossFinalArtifactInput } from "./build_lock_loss_final_artifact_input.ts"
import { buildProgramFailure } from "./build_program_failure.ts"
import { classifyProgramResult } from "./classify_program_result.ts"
import type { FinalArtifactReceipt } from "./final_artifact_types.ts"
import type { CanaryProgramDependencies,
  CanaryProgramResult, CanaryTerminalContext } from "./program_types.ts"

export async function recoverFinalizationLockLoss(
  terminal: CanaryTerminalContext,
  published: FinalArtifactReceipt,
  dependencies: CanaryProgramDependencies,
): Promise<CanaryProgramResult> {
  terminal.runtime.lock.retainUntilExit?.()
  let invalidated
  try {
    invalidated = await dependencies.invalidateFinalArtifact(published)
  } catch {
    return buildProgramFailure("manual")
  }
  const receiptUpdated = await appendFinalizationLockLoss(
    terminal.artifactInput.receipt, dependencies,
  )
  if (!receiptUpdated) return buildProgramFailure("manual")
  const manualInput = buildLockLossFinalArtifactInput(
    terminal.artifactInput,
    new Date(dependencies.nowUtcMs()).toISOString(),
  )
  try {
    const manual = await dependencies.writeFinalArtifact(manualInput, {
      preservedInvalidated: invalidated,
    })
    return classifyProgramResult(manual)
  } catch {
    await appendFinalArtifactFailure(manualInput.receipt, dependencies)
    return buildProgramFailure("manual")
  }
}
