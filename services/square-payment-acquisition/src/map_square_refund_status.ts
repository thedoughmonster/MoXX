import type { PaymentStatus } from "./types.ts"

export function mapSquareRefundStatus(status: string | null): PaymentStatus {
  if (status === "PENDING") return "refund_pending"
  if (status === "APPROVED" || status === "COMPLETED") return "refunded"
  if (status === "REJECTED" || status === "FAILED") return "paid"
  return "indeterminate"
}
