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
  const preflightExecutables = await dependencies.resolveExecutables(dependencies.environment)
  const lock = await dependencies.acquireLock(dependencies.environment)
  let provider
  try {
    if (lock.flockPath !== preflightExecutables.flockExecutable) {
      throw new Error("Runtime lock executable changed during preparation")
    }
    const candidate = await dependencies.collectEvidence(
      repositoryRoot,
      preflightExecutables,
      dependencies.runChild,
      dependencies.nodeVersion,
      dependencies.environment,
      dependencies.createProvider,
    )
    provider = candidate.provider
    if (candidate.repository.projectRef !== options.projectRef) {
      throw new Error("Runtime repository scope does not match invocation")
    }
    return {
      options, repository: candidate.repository,
      executables: preflightExecutables,
      provider,
      lock,
    }
  } catch (error) {
    let cleanupFailed = false
    if (provider) try { await provider.close() } catch { cleanupFailed = true }
    try { await lock.release() } catch { cleanupFailed = true }
    if (cleanupFailed) throw new Error("Runtime preparation cleanup failed")
    throw error
  }
}
