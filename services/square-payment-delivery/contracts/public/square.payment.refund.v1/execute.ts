import { executeSquareRefund } from "../../../src/execute_square_refund.ts"
import type {
  RefundExecutionCommand,
  RefundExecutionResult,
  RefundExecutionRuntime,
} from "./types.ts"

export async function executeRefund(
  command: RefundExecutionCommand,
  runtime?: RefundExecutionRuntime,
): Promise<RefundExecutionResult> {
  const environment = runtime?.environment
  const accessToken = environment?.SQUARE_SANDBOX_ACCESS_TOKEN ??
    Deno.env.get("SQUARE_SANDBOX_ACCESS_TOKEN")
  const configuredLocation = environment?.SQUARE_SANDBOX_LOCATION_ID ??
    Deno.env.get("SQUARE_SANDBOX_LOCATION_ID")
  const apiVersion = environment?.SQUARE_API_VERSION ??
    Deno.env.get("SQUARE_API_VERSION") ?? "2026-07-15"
  if (!accessToken || configuredLocation !== command.location_id) {
    return {
      outcome: "indeterminate", payment_status: "indeterminate",
      provider_payment_id: command.provider_payment_id,
      provider_refund_id: null, provider_updated_at: null,
      provider_request_id: null, recovery: "operator_review",
    }
  }
  return await executeSquareRefund(
    command, accessToken, apiVersion, runtime?.fetcher,
  )
}
