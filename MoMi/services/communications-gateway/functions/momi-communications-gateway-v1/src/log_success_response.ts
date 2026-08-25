import type { JSONValue } from "postgres"
import type { LogReceipt } from "./log_receipt.ts"

export function logSuccessResponse(
  invocationId: string,
  receipt: LogReceipt,
): Record<string, JSONValue> {
  return {
    id: invocationId,
    object: "momi.log",
    model: "momi-assistant",
    status: "completed",
    disposition: "stored",
    selection_id: receipt.selection_id,
    shop_log_id: receipt.shop_log_id,
  }
}
