import type { ClaimedOperation, Database, DeliveryResult, FinalStatus } from "./types.ts"

export async function finishOperation(
  database: Database,
  operation: ClaimedOperation,
  result: DeliveryResult,
  clientIdentifier: string,
): Promise<FinalStatus> {
  const rows = await database`
    select disposition, operation_status
    from momi_trello_delivery.finish_operation_status_v1(
      ${operation.operationId}::uuid,
      ${operation.capabilityToken},
      ${clientIdentifier},
      ${result.finalStatus},
      ${result.httpStatus},
      ${database.json(result.headers)},
      ${result.payload === null ? null : database.json(result.payload)},
      ${result.rawText},
      ${result.errorCode}
    )
  `
  const row = rows[0]
  if (
    rows.length !== 1 || row.disposition !== "recorded"
    || !["succeeded", "failed", "ambiguous"].includes(String(row.operation_status))
  ) throw new Error("Trello card move completion returned an invalid result")
  return row.operation_status as FinalStatus
}
