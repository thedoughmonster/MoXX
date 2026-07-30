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
  amount_money?: Money
}

export type SquareError = { category?: string; code?: string }

export type SquareEnvelope = {
  payment?: SquarePayment
  errors?: SquareError[]
}

export type PaymentReceipt = {
  outcome: "accepted" | "rejected" | "pending" | "indeterminate"
  payment_status: "authorized" | "paid" | "declined" | "canceled" |
    "pending" | "indeterminate"
  provider_payment_id?: string
  recovery: "none" | "retrieve" | "operator_review"
}

export type SquareRequest = {
  url: string
  init: RequestInit
}
