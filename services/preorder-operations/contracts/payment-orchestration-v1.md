# Preorder payment orchestration v1

## Authority

`preorder-operations` owns the attempt identity, accepted terms, claim,
idempotency, order projection, and customer-safe receipt. Square delivery owns
the paid provider call. Square acquisition owns retrieval and exact-byte
webhook authentication. A Square receipt is financial evidence, not permission
to replace preorder truth directly.

## Initiation

1. The Logic-owned public handler validates
   `momi.preorder.payment.initiate.v1`, retains `source_token` only in memory,
   and admits the recovery authority through the bounded request gate.
2. It removes `source_token` and calls
   `claim_payment_attempt_v1(request, recovery_authority, location_id)`, where
   `location_id` is the server-configured Square location selected by the
   adapter boundary.
3. Only `disposition=claimed` permits a provider call. The handler combines the
   returned claim fields with the in-memory token to call
   `square.payment.execute.v1` exactly once.
4. It converts the sanitized Square receipt to
   `payment-financial-evidence-v1` and calls
   `project_payment_evidence_v1(payment_attempt_id, claim_id, evidence)`.
5. It adds response metadata only after projection and returns the public
   `PaymentResponse`. It never returns the internal claim envelope.

`replay`, `busy`, `already_terminal`, and `operator_review` never call Square.
An expired initiation claim becomes indeterminate; it is never reacquired for
another paid call.

## Reconciliation

The Logic-owned reconcile handler validates
`momi.preorder.payment.reconcile.v1` and calls
`claim_payment_reconciliation_v1`. Only `claimed` permits the Square acquisition
adapter to retrieve the returned known `provider_payment_id`. Retrieval is a
read, so an expired reconciliation claim may be reclaimed. Missing provider
identity returns `operator_review`; it does not repeat payment creation.

The canonical retrieval result must include an evidence identity, canonical
payment status, provider payment identity and update time, owner order identity,
minor-unit amount, ISO currency, and configured location. Logic applies it only
through `project_payment_evidence_v1`.

## Webhooks

Square acquisition verifies the configured notification URL plus exact raw
request bytes before parsing. After authentication, it maps the provider event
to `payment-financial-evidence-v1` and calls
`project_payment_evidence_v1(payment_attempt_id, null, evidence)`. Evidence IDs
are durably hashed and deduplicated. Older provider timestamps cannot regress
state; equal conflicting facts and identity or money mismatches require review.
Correctness does not depend on webhook arrival.

## Privacy and failure handling

Source tokens, raw provider payloads, signature material, credentials, customer
contact, and cart contents never enter payment tables, claims, receipts, logs,
CI evidence, or issue records. Transport ambiguity projects indeterminate.
Only matched durable evidence may confirm payment, and a refund never silently
changes MoMi fulfillment truth.
