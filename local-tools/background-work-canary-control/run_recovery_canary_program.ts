import { createCanaryProgramDependencies } from "./create_canary_program_dependencies.ts"
import type { RecoveryResult } from "./recovery_types.ts"
import { runPreparedRecoveryCanary } from "./run_prepared_recovery_canary.ts"

export async function runRecoveryCanaryProgram(
  args: string[], repositoryRoot: string,
): Promise<RecoveryResult> {
  let runtime
  try { runtime = await createCanaryProgramDependencies().prepareRuntime(args, repositoryRoot) }
  catch { return { exitCode: 20, stderrCode: "PRE_GUARD_FAILURE", envelope: null } }
  let result
  try { result = await runPreparedRecoveryCanary(runtime, repositoryRoot) } catch {
    runtime.lock.retainUntilExit?.()
    result = { exitCode: 40, stderrCode: "MANUAL_RECONCILIATION_REQUIRED",
      envelope: null } as const
  }
  try { await runtime.provider.close() } catch {
    return { exitCode: 40, stderrCode: "MANUAL_RECONCILIATION_REQUIRED", envelope: null }
  }
  return result
}
