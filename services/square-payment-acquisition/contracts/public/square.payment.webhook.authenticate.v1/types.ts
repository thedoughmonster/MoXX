export type WebhookAuthenticationCommand = {
  raw_body: Uint8Array
  signature: string
}

export type WebhookFinancialEvidence = {
  evidence_id: string
  source: "webhook"
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

export type WebhookAuthenticationResult = {
  disposition: "authenticated" | "ignored" | "retryable" |
    "rejected" | "unavailable"
  evidence: WebhookFinancialEvidence | null
  error_code: string | null
}

export type WebhookAuthenticationRuntime = {
  environment?: Readonly<Record<string, string | undefined>>
  fetcher?: typeof fetch
}
