import { assertRefundCommand } from "./assert_refund_command.ts"
import { classifySquareRefund } from "./classify_square_refund.ts"
import { squareSandboxOrigin } from "./constants.ts"
import type { RefundCommand, RefundReceipt, SquareEnvelope } from "./types.ts"

export async function executeSquareRefund(
  command: RefundCommand,
  accessToken: string,
  apiVersion: string,
  fetcher: typeof fetch = fetch,
): Promise<RefundReceipt> {
  assertRefundCommand(command)
  const indeterminate: RefundReceipt = {
    outcome: "indeterminate", payment_status: "indeterminate",
    provider_payment_id: command.provider_payment_id,
    provider_refund_id: null, provider_updated_at: null,
    provider_request_id: null, recovery: "retrieve",
  }
  if (!accessToken || !/^20\d{2}-\d{2}-\d{2}$/.test(apiVersion)) {
    throw new Error("invalid_square_configuration")
  }
  try {
    const response = await fetcher(`${squareSandboxOrigin}/v2/refunds`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(8_000),
      headers: {
        Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json",
        "Square-Version": apiVersion,
      },
      body: JSON.stringify({
        idempotency_key: command.refund_attempt_id,
        payment_id: command.provider_payment_id,
        amount_money: { amount: command.amount_minor, currency: command.currency },
        reason: "Order refund",
      }),
    })
    const provider_request_id = response.headers.get("x-request-id")
    const envelope = await response.json() as SquareEnvelope
    if (!response.ok || !envelope.refund) {
      return { ...indeterminate, provider_request_id,
        recovery: response.status >= 500 ? "retrieve" : "operator_review" }
    }
    return { ...classifySquareRefund(envelope.refund, command), provider_request_id }
  } catch {
    return indeterminate
  }
}
