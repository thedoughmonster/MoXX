import { captureEvidence } from "./capture_evidence.ts"
import { failInvocation } from "./fail_invocation.ts"
import type { Admission, ChatInput } from "./types.ts"

export async function archiveFailure(
  input: ChatInput,
  admission: Admission,
  failureCode: string,
): Promise<void> {
  const receipt = await captureEvidence(input, admission.invocation_id, 90,
    "post_admission_failure", { failure_code: failureCode },
    admission.provider_key, admission.provider_model, "failed")
  if (!await failInvocation(admission.invocation_id, receipt.archive_item_id, failureCode)) {
    throw new Error("failure_terminalization_failed")
  }
}
