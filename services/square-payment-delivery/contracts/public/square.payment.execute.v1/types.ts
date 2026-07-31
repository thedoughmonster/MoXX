export type PaymentExecutionCommand = {
  payment_attempt_id: string
  owner_order_id: string
  amount_minor: number
  currency: "USD"
  location_id: string
  source_token: string
}

export type PaymentFinancialEvidence = {
  evidence_id: string
  source: "delivery"
  disposition: "matched" | "mismatch" | "indeterminate"
  payment_status: "pending" | "authorized" | "paid" | "declined" |
    "canceled" | "indeterminate"
  provider_payment_id: string | null
  provider_updated_at: string | null
  order_id: string
  amount_minor: number
  currency: "USD"
  location_id: string
}

export type PaymentExecutionRuntime = {
  environment?: Readonly<Record<string, string | undefined>>
  fetcher?: typeof fetch
}
