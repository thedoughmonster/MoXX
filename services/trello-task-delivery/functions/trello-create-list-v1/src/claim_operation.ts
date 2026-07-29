import type { ClaimedOperation, Database, WorkRequest } from "./types.ts"

export async function claimOperation(
  database: Database,
  work: WorkRequest,
): Promise<ClaimedOperation | null> {
  const rows = await database`
    select operation_id::text, operation_type, board_id, list_name, list_position
    from momi_trello_delivery.claim_operation_v1(
      ${work.operationId}::uuid,
      ${work.capabilityToken}
    )
  `
  const row = rows[0]
  if (rows.length === 0) return null
  if (
    rows.length !== 1 || row.operation_type !== "create_list"
    || typeof row.operation_id !== "string" || typeof row.board_id !== "string"
    || typeof row.list_name !== "string"
    || (row.list_position !== "top" && row.list_position !== "bottom")
  ) throw new Error("Trello delivery claim returned an invalid result")
  return {
    ...work,
    operationId: row.operation_id,
    operationType: row.operation_type,
    boardId: row.board_id,
    listName: row.list_name,
    listPosition: row.list_position,
  }
}
