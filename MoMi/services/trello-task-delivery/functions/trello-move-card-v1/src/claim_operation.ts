import type { ClaimedOperation, Database, WorkRequest } from "./types.ts"

export async function claimOperation(
  database: Database,
  work: WorkRequest,
): Promise<ClaimedOperation | null> {
  const rows = await database`
    select operation_id::text, board_id, card_id, target_list_id
    from momi_trello_delivery.claim_move_card_v1(
      ${work.operationId}::uuid,
      ${work.capabilityToken}
    )
  `
  const row = rows[0]
  if (rows.length === 0) return null
  if (
    rows.length !== 1 || typeof row.operation_id !== "string"
    || typeof row.board_id !== "string" || typeof row.card_id !== "string"
    || typeof row.target_list_id !== "string"
  ) throw new Error("Trello card move claim returned an invalid result")
  return {
    ...work,
    operationId: row.operation_id,
    operationType: "move_card",
    boardId: row.board_id,
    cardId: row.card_id,
    targetListId: row.target_list_id,
  }
}
