import { captureEvidence } from "./capture_evidence.ts"
import { getDatabase } from "./database.ts"
import { failInvocation } from "./fail_invocation.ts"
import type { Admission, ChatInput } from "./types.ts"

export async function archiveFailure(
  input: ChatInput,
  admission: Admission,
  failureCode: string,
): Promise<void> {
  const sql = getDatabase()
  const rows = await sql<{ provider_model: string }[]>`
    select provider_model from momi_communications_gateway.invocations
    where invocation_id = ${admission.invocation_id}::uuid
  `
  const receipt = await captureEvidence(input, admission.invocation_id, 90,
    "post_admission_failure", { failure_code: failureCode },
    admission.provider_key, rows[0]?.provider_model ?? admission.provider_model, "failed")
  if (!await failInvocation(admission.invocation_id, receipt.archive_item_id, failureCode)) {
    throw new Error("failure_terminalization_failed")
  }
}
