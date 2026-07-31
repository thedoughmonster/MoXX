export type RefundExecutionCommand = {
  refund_attempt_id: string
  provider_payment_id: string
  owner_order_id: string
  amount_minor: number
  currency: "USD"
  location_id: string
}

export type RefundExecutionResult = {
  outcome: "accepted" | "pending" | "rejected" | "indeterminate"
  payment_status: "refund_pending" | "refunded" | "paid" | "indeterminate"
  provider_payment_id: string
  provider_refund_id: string | null
  provider_updated_at: string | null
  provider_request_id: string | null
  recovery: "none" | "retrieve" | "operator_review"
}

export type RefundExecutionRuntime = {
  environment?: Readonly<Record<string, string | undefined>>
  fetcher?: typeof fetch
}
