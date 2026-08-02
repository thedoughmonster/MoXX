import { buildProgramFailure } from "./build_program_failure.ts"
import type { CanaryProgramDependencies,
  CanaryProgramResult } from "./program_types.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"
import { runPreparedCanaryProgram } from "./run_prepared_canary_program.ts"

export async function runCanaryControlProgram(
  args: string[],
  repositoryRoot: string,
  dependencies: CanaryProgramDependencies,
): Promise<CanaryProgramResult> {
  let runtime: ReleasedRuntime
  try {
    runtime = await dependencies.prepareRuntime(args, repositoryRoot)
  } catch {
    return buildProgramFailure("pre_guard")
  }
  let result: CanaryProgramResult
  try {
    result = await runPreparedCanaryProgram(runtime, repositoryRoot, dependencies)
  } catch {
    runtime.lock.retainUntilExit?.()
    result = buildProgramFailure("manual")
  }
  try { await runtime.provider.close() } catch {
    return buildProgramFailure(result.exitCode === 20 ? "pre_guard" : "manual")
  }
  return result
}
