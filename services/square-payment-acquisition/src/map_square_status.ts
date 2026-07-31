import type { PaymentStatus } from "./types.ts"

export function mapSquarePaymentStatus(status: string | null): PaymentStatus {
  if (status === "COMPLETED") return "paid"
  if (status === "APPROVED") return "authorized"
  if (status === "PENDING") return "pending"
  if (status === "CANCELED") return "canceled"
  if (status === "FAILED") return "declined"
  return "indeterminate"
}
