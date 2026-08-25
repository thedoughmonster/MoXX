import { deriveSetupBinding } from "./derive_setup_binding.ts"
import { parsePublicInvocation } from "./parse_public_invocation.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"
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
  const flockCapability = await dependencies.testFlock(preflightExecutables.flockExecutable)
  const lock = await dependencies.acquireLock(dependencies.environment)
  let provider
  let releaseSha: string | undefined
  let providerWorkBegan = false
  try {
    if (lock.flockPath !== preflightExecutables.flockExecutable) {
      throw new Error("Runtime lock executable changed during preparation")
    }
    const repository = await dependencies.collectEvidence(
      repositoryRoot,
      preflightExecutables,
      dependencies.runChild,
      dependencies.nodeVersion,
      dependencies.environment,
    )
    releaseSha = repository.headSha
    if (repository.projectRef !== options.projectRef) {
      throw new Error("Runtime repository scope does not match invocation")
    }
    const linkage = await dependencies.validateLinkage(repositoryRoot)
    const binding = deriveSetupBinding(
      repositoryRoot, repository, linkage, flockCapability,
    )
    const receiptRoot = await dependencies.prepareReceiptRoot()
    const setupReceipt = await dependencies.claimReceipt(
      receiptRoot, binding, dependencies.nowMs(),
    )
    providerWorkBegan = true
    try {
      provider = await dependencies.createProvider(
        repositoryRoot, dependencies.environment, dependencies.runChild,
      )
    } catch {
      throw new SetupPreflightError("ProviderPreparationFailed", "provider", {
        releaseSha, providerWorkBegan: true,
      })
    }
    return {
      options, repository,
      executables: preflightExecutables,
      provider,
      lock,
      setupReceipt,
    }
  } catch (error) {
    let cleanupFailed = false
    if (provider) try { await provider.close() } catch { cleanupFailed = true }
    try { await lock.release() } catch { cleanupFailed = true }
    if (cleanupFailed) throw new Error("Runtime preparation cleanup failed")
    if (error instanceof SetupPreflightError) {
      throw new SetupPreflightError(error.category, error.stage, {
        childExitCode: error.childExitCode, sqlstate: error.sqlstate,
        releaseSha: error.releaseSha ?? releaseSha,
        providerWorkBegan: error.providerWorkBegan || providerWorkBegan,
      })
    }
    throw new SetupPreflightError("RepositoryEvidenceInvalid", "repository", {
      releaseSha, providerWorkBegan,
    })
  }
}
