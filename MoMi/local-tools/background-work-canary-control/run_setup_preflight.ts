import { deriveSetupBinding } from "./derive_setup_binding.ts"
import { parsePublicInvocation } from "./parse_public_invocation.ts"
import { SETUP_RECEIPT_SCHEMA, SETUP_RECEIPT_TTL_MS,
  SETUP_STAGE_ORDER } from "./setup_preflight_constants.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"
import type {
  SetupProgramDependencies,
  SetupProgramResult,
} from "./setup_program_types.ts"
import { verifySqlArtifact } from "./verify_sql_artifact.ts"

export async function runSetupPreflight(
  args: string[],
  repositoryRoot: string,
  dependencies: SetupProgramDependencies,
): Promise<SetupProgramResult> {
  const startedMs = dependencies.nowMs()
  let receiptRoot: string | undefined
  let releaseSha: string | null = null
  let providerWorkBegan = false
  try {
    receiptRoot = await dependencies.prepareReceiptRoot()
    parsePublicInvocation(args)
    await dependencies.assertReceiptAvailable(receiptRoot)
    let executables
    let repository
    try {
      executables = await dependencies.resolveExecutables(dependencies.environment)
      repository = await dependencies.collectRepository(repositoryRoot, executables)
      verifySqlArtifact(repositoryRoot, "fast")
      verifySqlArtifact(repositoryRoot, "resource")
      releaseSha = repository.headSha
    } catch {
      throw new SetupPreflightError("RepositoryEvidenceInvalid", "repository")
    }
    const flock = await dependencies.testFlock(executables.flockExecutable)
    providerWorkBegan = true
    let linked
    try { linked = await dependencies.linkProject(repositoryRoot) } catch {
      throw new SetupPreflightError("SupabaseLinkFailed", "link")
    }
    if (linked.outcome.status !== "success" || linked.outcome.exitCode !== 0) {
      const childExitCode = Number.isSafeInteger(linked.outcome.exitCode) &&
        (linked.outcome.exitCode as number) > 0 ? linked.outcome.exitCode as number : undefined
      throw new SetupPreflightError("SupabaseLinkFailed", "link", { childExitCode })
    }
    const linkage = await dependencies.validateLinkage(repositoryRoot)
    const binding = deriveSetupBinding(repositoryRoot, repository, linkage, flock)
    const completedMs = dependencies.nowMs()
    const receipt = await dependencies.writeReceipt(receiptRoot, {
      ...binding,
      schemaVersion: SETUP_RECEIPT_SCHEMA,
      status: "ready",
      stage: "receipt",
      startedAtUtc: new Date(startedMs).toISOString(),
      expiresAtUtc: new Date(completedMs + SETUP_RECEIPT_TTL_MS).toISOString(),
      durationMs: Math.max(0, completedMs - startedMs),
      providerWorkBegan: true,
      hostedMutationPossible: false,
      completedStages: SETUP_STAGE_ORDER,
    })
    return {
      exitCode: 0,
      stderrCode: null,
      envelope: {
        status: "setup_ready",
        receiptPath: receipt.receiptPath,
        receiptSha256: receipt.receiptSha256,
      },
    }
  } catch (error) {
    const failure = error instanceof SetupPreflightError ? error :
      new SetupPreflightError("RepositoryEvidenceInvalid", "repository")
    if (!receiptRoot) return { exitCode: 20, stderrCode: failure.category, envelope: null }
    try {
      const completedMs = dependencies.nowMs()
      const receipt = await dependencies.writeFailure(receiptRoot, {
        schemaVersion: SETUP_RECEIPT_SCHEMA,
        status: "blocked",
        releaseSha,
        stage: failure.stage,
        errorCategory: failure.category,
        childExitCode: failure.childExitCode ?? null,
        sqlstate: failure.sqlstate && /^[0-9A-Z]{5}$/.test(failure.sqlstate)
          ? failure.sqlstate : null,
        startedAtUtc: new Date(startedMs).toISOString(),
        durationMs: Math.max(0, completedMs - startedMs),
        providerWorkBegan,
        hostedMutationPossible: false,
      })
      return {
        exitCode: 20,
        stderrCode: failure.category,
        envelope: {
          status: "setup_blocked",
          stage: failure.stage,
          errorCategory: failure.category,
          receiptPath: receipt.receiptPath,
          receiptSha256: receipt.receiptSha256,
        },
      }
    } catch {
      return { exitCode: 20, stderrCode: "SetupReceiptFailed", envelope: null }
    }
  }
}
