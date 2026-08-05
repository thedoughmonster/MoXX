import { discoverReleasedRepositoryRoot } from "./discover_released_repository_root.ts"
import { emitRecoveryClassificationResult } from "./emit_recovery_classification_result.ts"
import { runRecoveryClassificationProgram } from "./run_recovery_classification_program.ts"

export async function invokeRecoveryClassificationMain(
  args: string[], moduleUrl: string,
): Promise<number> {
  let result
  try { result = await runRecoveryClassificationProgram(args,
    discoverReleasedRepositoryRoot(moduleUrl)) } catch {
    result = { exitCode: 40, stderrCode: "MANUAL_RECONCILIATION_REQUIRED",
      envelope: null } as const
  }
  emitRecoveryClassificationResult(result)
  return result.exitCode
}
