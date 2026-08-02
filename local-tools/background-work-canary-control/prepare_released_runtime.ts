import { parsePublicInvocation } from "./parse_public_invocation.ts"
import type {
  ReleasedRuntime,
  RuntimePreparationDependencies,
} from "./runtime_adapter_types.ts"

export async function prepareReleasedRuntime(
  args: string[],
  repositoryRoot: string,
  dependencies: RuntimePreparationDependencies,
): Promise<ReleasedRuntime> {
  const options = parsePublicInvocation(args)
  const executables = await dependencies.resolveExecutables(dependencies.environment)
  const lock = await dependencies.acquireLock(dependencies.environment)
  try {
    if (lock.flockPath !== executables.flockExecutable) {
      throw new Error("Runtime lock executable changed during preparation")
    }
    const repository = await dependencies.collectEvidence(
      repositoryRoot,
      executables,
      dependencies.runChild,
      dependencies.nodeVersion,
      dependencies.environment,
    )
    if (repository.projectRef !== options.projectRef) {
      throw new Error("Runtime repository scope does not match invocation")
    }
    return { options, repository, executables, lock }
  } catch (error) {
    await lock.release()
    throw error
  }
}
