import { runCommand } from "../run_command.ts"
import { validateValidationReceipt } from "../../dev_loop/validate_validation_receipt.ts"
import { downloadRetentionEvidence } from "./download_evidence.ts"
import { readSuccessfulRetentionRun } from "./read_successful_run.ts"
import type { RetentionApproval } from "./types.ts"

export function verifyRetentionEvidence(approval: RetentionApproval): string | undefined {
  readSuccessfulRetentionRun(approval.validation.run_id, approval.validation.head_sha, "validation")
  const validation = validateValidationReceipt(downloadRetentionEvidence(
    approval.validation.run_id, `validation-${approval.validation.head_sha}`,
    "validation-receipt.json", approval.validation.receipt_sha256,
  ))
  const tree = runCommand("git", ["rev-parse", `${approval.source_sha}^{tree}`], { capture: true }).stdout.trim()
  if (validation.counts.hard_failed !== 0 || validation.gate !== "full" ||
      validation.identities.head_sha !== approval.validation.head_sha ||
      validation.identities.head_tree !== tree ||
      Number(validation.run_log.run_id) !== approval.validation.run_id) {
    throw new Error("Retention source tree differs from authoritative validation")
  }
  if (approval.environment === "prod") {
    const pin = approval.dev_receipt!
    const run = readSuccessfulRetentionRun(pin.run_id, approval.source_sha, "development")
    const receipt = downloadRetentionEvidence(pin.run_id,
      `retention-dev-${approval.source_sha}-${pin.run_id}`, "retention-release-receipt.json",
      pin.sha256, pin.artifact_id) as Record<string, unknown>
    if (run.run_attempt !== pin.run_attempt || receipt.run_attempt !== pin.run_attempt ||
      receipt.kind !== "retention_exception_release" || receipt.environment !== "dev" ||
      receipt.project_ref !== "xtbraqnlskmqxinjxxdn" || receipt.source_sha !== approval.source_sha ||
      receipt.function_source_sha256 !== approval.function_source_sha256 ||
      receipt.phase !== "disarmed" || receipt.run_id !== pin.run_id ||
      JSON.stringify(receipt.migrations) !== JSON.stringify(["20261022172534"])) {
      throw new Error("Production lacks exact development exception evidence")
    }
    const governor = receipt.governor as { ezbr_sha256?: unknown } | undefined
    if (typeof governor?.ezbr_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(governor.ezbr_sha256)) {
      throw new Error("Development governor bundle attestation absent")
    }
    return governor.ezbr_sha256
  }
  return undefined
}
