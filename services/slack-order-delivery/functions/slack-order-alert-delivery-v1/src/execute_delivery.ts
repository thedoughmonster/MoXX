import { claimWork } from "./claim_work.ts"
import { deliverClaimedWork } from "./deliver_claimed_work.ts"
import type { ExecutionResult } from "./types.ts"

export async function executeDelivery(
  workId: string,
  triggerToken: string,
  codeCommitSha: string,
  deploymentId: string | null,
): Promise<ExecutionResult> {
  const claim = await claimWork(
    workId,
    triggerToken,
    codeCommitSha,
    deploymentId,
  )

  if (claim.disposition === "not_found") {
    return { status: 404, body: { ok: false, disposition: "not_found", work_id: workId } }
  }
  if (claim.disposition === "unavailable") {
    return { status: 409, body: { ok: false, disposition: "unavailable", work_id: workId } }
  }
  if (claim.disposition === "already_succeeded") {
    return { status: 200, body: {
      ok: true,
      disposition: "already_succeeded",
      work_id: workId,
      ...(claim.attempt_id ? { attempt_id: claim.attempt_id } : {}),
      ...(claim.invocation_id ? { invocation_id: claim.invocation_id } : {}),
      ...(claim.channel ? { channel: claim.channel } : {}),
      ...(claim.ts ? { ts: claim.ts } : {}),
    } }
  }

  return deliverClaimedWork(claim)
}
