import type { ClaimedOperation, Database, WorkRequest } from "./types.ts"

export async function claimOperation(
  database: Database,
  work: WorkRequest,
): Promise<ClaimedOperation | null> {
  const rows = await database`
    select operation_id::text, board_id, callback_url, description,
      inventory_job_id::text, inventory_completed_at::text,
      callback_head_evidence_ref, callback_head_verified_at::text,
      callback_head_http_status
    from momi_trello_delivery.claim_register_webhook_v1(
      ${work.operationId}::uuid,
      ${work.capabilityToken}
    )
  `
  const row = rows[0]
  if (rows.length === 0) return null
  if (
    rows.length !== 1 || typeof row.operation_id !== "string"
    || typeof row.board_id !== "string" || typeof row.callback_url !== "string"
    || typeof row.description !== "string" || typeof row.inventory_job_id !== "string"
    || typeof row.inventory_completed_at !== "string"
    || typeof row.callback_head_evidence_ref !== "string"
    || typeof row.callback_head_verified_at !== "string"
    || row.callback_head_http_status !== 200
  ) throw new Error("Trello webhook registration claim returned an invalid result")
  return {
    ...work,
    operationId: row.operation_id,
    operationType: "register_webhook",
    boardId: row.board_id,
    callbackUrl: row.callback_url,
    description: row.description,
    inventoryJobId: row.inventory_job_id,
    inventoryCompletedAt: row.inventory_completed_at,
    callbackHeadEvidenceRef: row.callback_head_evidence_ref,
    callbackHeadVerifiedAt: row.callback_head_verified_at,
    callbackHeadHttpStatus: 200,
  }
}
