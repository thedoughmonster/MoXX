import { buildProgramFailure } from "./build_program_failure.ts"
import { createCanaryProgramDependencies } from "./create_canary_program_dependencies.ts"
import { discoverReleasedRepositoryRoot } from "./discover_released_repository_root.ts"
import { emitProgramResult } from "./emit_program_result.ts"
import { runCanaryControlProgram } from "./run_canary_control_program.ts"

export async function invokeCanaryControlMain(
  args: string[],
  moduleUrl: string,
): Promise<number> {
  let result
  try {
    const repositoryRoot = discoverReleasedRepositoryRoot(moduleUrl)
    result = await runCanaryControlProgram(
      args, repositoryRoot, createCanaryProgramDependencies(),
    )
  } catch {
    result = buildProgramFailure("pre_guard")
  }
  emitProgramResult(result, {
    stdout: (value) => { process.stdout.write(value) },
    stderr: (value) => { process.stderr.write(value) },
  })
  return result.exitCode
}
