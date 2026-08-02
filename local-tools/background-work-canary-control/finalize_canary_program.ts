import { appendFinalArtifactFailure } from "./append_final_artifact_failure.ts"
import { appendFinalizationLockLoss } from "./append_finalization_lock_loss.ts"
import { buildProgramFailure } from "./build_program_failure.ts"
import { classifyProgramResult } from "./classify_program_result.ts"
import { recoverFinalizationLockLoss } from "./recover_finalization_lock_loss.ts"
import type { CanaryProgramDependencies,
  CanaryProgramResult, CanaryTerminalContext } from "./program_types.ts"

export async function finalizeCanaryProgram(
  terminal: CanaryTerminalContext,
  dependencies: CanaryProgramDependencies,
): Promise<CanaryProgramResult> {
  const lock = terminal.runtime.lock
  let published
  try {
    published = await dependencies.writeFinalArtifact(terminal.artifactInput, {
      beforePublish: () => {
        if (lock.status() !== "held" || lock.lossSignal.aborted) {
          throw new Error("Lifecycle lock was lost before artifact publication")
        }
      },
    })
  } catch {
    if (lock.status() === "lost" || lock.lossSignal.aborted) {
      await appendFinalizationLockLoss(terminal.artifactInput.receipt, dependencies)
    } else {
      await appendFinalArtifactFailure(terminal.artifactInput.receipt, dependencies)
    }
    if (terminal.artifactInput.status === "pre_guard_failure") {
      try { await lock.release() } catch { /* process exit also releases */ }
      return buildProgramFailure("pre_guard")
    }
    lock.retainUntilExit?.()
    return buildProgramFailure("manual")
  }
  if (terminal.retainLock) {
    lock.retainUntilExit?.()
    return classifyProgramResult(published)
  }
  try {
    await lock.release()
    if (lock.status() !== "released" || lock.lossSignal.aborted) throw new Error()
  } catch {
    return await recoverFinalizationLockLoss(terminal, published, dependencies)
  }
  return classifyProgramResult(published)
}
