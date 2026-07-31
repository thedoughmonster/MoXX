export type PaymentRetrievalCommand = {
  provider_payment_id: string
  order_id: string
  amount_minor: number
  currency: string
  location_id: string
}

export type PaymentFinancialEvidence = {
  evidence_id: string
  source: "reconciliation"
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

export type PaymentRetrievalRuntime = {
  environment?: Readonly<Record<string, string | undefined>>
  fetcher?: typeof fetch
}
