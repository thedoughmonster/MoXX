import {
  PROGRAM_EXIT_MANUAL,
  PROGRAM_EXIT_PRE_GUARD,
  PROGRAM_EXIT_RECOVERED_UNSUCCESSFUL,
  PROGRAM_EXIT_SUCCESS,
  PROGRAM_STDERR_MANUAL,
  PROGRAM_STDERR_PRE_GUARD,
  PROGRAM_STDERR_RECOVERED,
} from "./program_constants.ts"
import type { FinalArtifactReceipt } from "./final_artifact_types.ts"
import type { CanaryProgramResult } from "./program_types.ts"

export function classifyProgramResult(
  receipt: FinalArtifactReceipt,
): CanaryProgramResult {
  const status = receipt.artifact.terminal.status
  const envelope = {
    status, runId: receipt.artifact.runId,
    finalReceiptPath: receipt.path,
    finalReceiptSha256: receipt.sha256,
  }
  if (status === "inactive_dry_run_verified") {
    return { exitCode: PROGRAM_EXIT_SUCCESS, stderrCode: null, envelope }
  }
  if (status === "pre_guard_failure") {
    return {
      exitCode: PROGRAM_EXIT_PRE_GUARD,
      stderrCode: PROGRAM_STDERR_PRE_GUARD, envelope,
    }
  }
  if (status === "manual_reconciliation_required") {
    return {
      exitCode: PROGRAM_EXIT_MANUAL,
      stderrCode: PROGRAM_STDERR_MANUAL, envelope,
    }
  }
  return {
    exitCode: PROGRAM_EXIT_RECOVERED_UNSUCCESSFUL,
    stderrCode: PROGRAM_STDERR_RECOVERED, envelope,
  }
}
