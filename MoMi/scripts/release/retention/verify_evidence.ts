import { runCommand } from "../run_command.ts"
import { validateValidationReceipt } from "../../dev_loop/validate_validation_receipt.ts"
import { buildBoundPlan } from "../../dev_loop/build_bound_plan.ts"
import { assertRetentionValidationBinding } from "./assert_validation_binding.ts"
import { downloadRetentionEvidence } from "./download_evidence.ts"
import { readSuccessfulRetentionRun } from "./read_successful_run.ts"
import type { RetentionApproval } from "./types.ts"

export async function verifyRetentionEvidence(approval: RetentionApproval): Promise<string | undefined> {
  readSuccessfulRetentionRun(approval.validation.run_id, approval.validation.head_sha, "validation")
  const validation = validateValidationReceipt(downloadRetentionEvidence(
    approval.validation.run_id, `validation-${approval.validation.head_sha}`,
    "validation-receipt.json", approval.validation.receipt_sha256,
  ))
  const tree = runCommand("git", ["rev-parse", `${approval.source_sha}^{tree}`], { capture: true }).stdout.trim()
  const plan = await buildBoundPlan(validation.identities.base_sha!, approval.source_sha, false)
  assertRetentionValidationBinding(approval, validation, plan, tree)
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
