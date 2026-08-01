export type Failure = {
  code: string
  message: string
  retryable: boolean
  next_action: string
}

export type PaymentReceipt = {
  outcome: "accepted" | "rejected" | "pending" | "conflict" | "indeterminate"
  order_id: string
  order_version: number
  payment_attempt_id: string
  payment_status: "not_started" | "pending" | "authorized" | "paid" |
    "declined" | "canceled" | "refund_pending" | "refunded" | "indeterminate"
  amount: { currency: string; amount_minor: number }
  next_actions: string[]
}

export type PaymentClaim = {
  claim_id: string
  claim_kind: "initiate" | "reconcile"
  payment_attempt_id: string
  owner_order_id: string
  amount_minor: number
  currency: string
  location_id: string
  provider_payment_id: string | null
}

export type PaymentClaimResult = {
  disposition?: "claimed" | "replay" | "busy" | "already_terminal" |
    "operator_review"
  receipt?: PaymentReceipt
  claim?: PaymentClaim | null
  outcome?: string
  error?: Failure
}

export type PaymentEvidence = {
  evidence_id: string
  source: "delivery" | "reconciliation" | "webhook"
  disposition: "matched" | "mismatch" | "missing" | "indeterminate"
  payment_status: "pending" | "authorized" | "paid" | "declined" |
    "canceled" | "refund_pending" | "refunded" | "indeterminate"
  provider_payment_id: string | null
  provider_updated_at: string | null
  order_id: string
  amount_minor: number
  currency: string
  location_id: string
}

export type PaymentProjection = {
  disposition?: string
  receipt?: PaymentReceipt
  outcome?: string
  error?: Failure
}
