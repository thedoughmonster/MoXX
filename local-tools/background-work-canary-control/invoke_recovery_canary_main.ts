import { discoverReleasedRepositoryRoot } from "./discover_released_repository_root.ts"
import { emitRecoveryResult } from "./emit_recovery_result.ts"
import { runRecoveryCanaryProgram } from "./run_recovery_canary_program.ts"

export async function invokeRecoveryCanaryMain(
  args: string[], moduleUrl: string,
): Promise<number> {
  let result
  try { result = await runRecoveryCanaryProgram(args,
    discoverReleasedRepositoryRoot(moduleUrl)) } catch {
    result = { exitCode: 20, stderrCode: "PRE_GUARD_FAILURE", envelope: null } as const
  }
  emitRecoveryResult(result)
  return result.exitCode
}
