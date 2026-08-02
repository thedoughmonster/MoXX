import { prepareReceiptRoot } from "./prepare_receipt_root.ts"
import { SETUP_RECEIPT_SCHEMA } from "./setup_preflight_constants.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"
import { writeSetupFailureReceipt } from "./write_setup_failure_receipt.ts"

export async function recordValidationPreflightFailure(
  error: unknown,
  startedMs: number,
  completedMs: number,
): Promise<void> {
  const failure = error instanceof SetupPreflightError ? error :
    new SetupPreflightError("RepositoryEvidenceInvalid", "repository")
  await writeSetupFailureReceipt(await prepareReceiptRoot(), {
    schemaVersion: SETUP_RECEIPT_SCHEMA,
    status: "blocked",
    releaseSha: failure.releaseSha ?? null,
    stage: failure.stage,
    errorCategory: failure.category,
    childExitCode: failure.childExitCode ?? null,
    sqlstate: failure.sqlstate && /^[0-9A-Z]{5}$/.test(failure.sqlstate)
      ? failure.sqlstate : null,
    startedAtUtc: new Date(startedMs).toISOString(),
    durationMs: Math.max(0, completedMs - startedMs),
    providerWorkBegan: failure.providerWorkBegan,
    hostedMutationPossible: false,
  })
}
