export type Money = { amount: number; currency: string }

export type PaymentCommand = {
  payment_attempt_id: string
  owner_order_id: string
  amount_minor: number
  currency: "USD"
  source_token: string
}

export type SquarePayment = {
  id?: string
  status?: string
  reference_id?: string
  location_id?: string
  updated_at?: string
  amount_money?: Money
}

export type SquareError = { category?: string; code?: string }

export type SquareRefund = {
  id?: string
  status?: string
  payment_id?: string
  location_id?: string
  updated_at?: string
  amount_money?: Money
}

export type SquareEnvelope = {
  payment?: SquarePayment
  refund?: SquareRefund
  errors?: SquareError[]
}

export type PaymentReceipt = {
  outcome: "accepted" | "rejected" | "pending" | "indeterminate"
  payment_status: "authorized" | "paid" | "declined" | "canceled" |
    "pending" | "indeterminate"
  provider_payment_id: string | null
  provider_updated_at: string | null
  provider_request_id: string | null
  recovery: "none" | "retrieve" | "operator_review"
}

export type FinancialEvidence = {
  evidence_id: string
  source: "delivery"
  disposition: "matched" | "mismatch" | "indeterminate"
  payment_status: PaymentReceipt["payment_status"]
  provider_payment_id: string | null
  provider_updated_at: string | null
  order_id: string
  amount_minor: number
  currency: "USD"
  location_id: string
}

export type RefundCommand = {
  refund_attempt_id: string
  provider_payment_id: string
  owner_order_id: string
  amount_minor: number
  currency: "USD"
  location_id: string
}

export type RefundReceipt = {
  outcome: "accepted" | "pending" | "rejected" | "indeterminate"
  payment_status: "refund_pending" | "refunded" | "paid" | "indeterminate"
  provider_payment_id: string
  provider_refund_id: string | null
  provider_updated_at: string | null
  provider_request_id: string | null
  recovery: "none" | "retrieve" | "operator_review"
}
