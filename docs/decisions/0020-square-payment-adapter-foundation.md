# 0020: Square Payment Adapter Foundation

- Status: accepted
- Date: 2026-07-29
- Owning issue: #274

## Context

ADR 0019 keeps preorder business state in `preorder-operations` and Square
financial state in Square. Issue #162 requires outbound provider mutations and
inbound provider evidence to remain separate adapter capabilities. The first
online payment slice must not create a second financial owner, expose raw card
data, persist a Web Payments token, or let an ambiguous provider response become
paid or permission for a blind retry.

The current development baseline has no active preorder publication, quote,
order-intent, payment-attempt, or Square runtime. Issues #271 through #273 must
establish those owner records before a hosted payment call can be safe.

## Decision

Introduce exactly two provider-boundary services with non-overlapping roles:

- `square-payment-delivery` is the sole destination adapter for outbound Square
  Payments API mutations. It maps one already-durable, owner-issued payment
  attempt identity to Square's idempotency key, sends exact money and
  order-reference values, and returns only a sanitized versioned receipt. It is
  shared by governed MoXi online-ordering services; preorder is only its first
  consumer.
- `square-payment-acquisition` is the sole acquisition adapter for independent
  Square payment retrieval and webhook authentication. It verifies the
  signature over the configured notification URL plus the exact raw request
  bytes before any JSON parsing.

Neither adapter owns payment truth. Square remains authoritative for financial
facts, while each governed ordering service owns its customer-safe order and
payment workflow. For issue #274, `preorder-operations` is that owner.
Terminal and other card-present paths are separate future adapters.

This first change is a non-hosted foundation. It declares the Sandbox host,
secret names, request mapping, response classification, and signature
verification, but adds no Edge Function, relation, migration, provider
configuration, or secret value. A later change may make the adapters callable
only after it can prove all of the following:

1. an authoritative quote and durable owner-issued order already exist;
2. one durable payment attempt owns the stable idempotency identity;
3. the single-use source token is neither persisted nor logged;
4. a timeout becomes indeterminate and enters reconciliation;
5. inbound evidence is archived and deduplicated before projection.

## Provider Contract

For online card-not-present payment, the browser may use Square Web Payments SDK
only to obtain one single-use token. The outbound adapter maps:

- `payment_attempt_id` to Square `idempotency_key`;
- `owner_order_id` to Square `reference_id`;
- exact minor units and ISO currency to `amount_money`;
- the server-configured location to `location_id`.

The adapter fails closed when Square returns a different order reference,
location, amount, or currency. Square does not return the request idempotency
key on the Payment object; the durable MoMi attempt preserves that correlation.
Payment-method errors are safe declines. Transport, authentication, rate-limit,
malformed, unknown, or
mismatched results are indeterminate and require reconciliation or operator
review. Provider response bodies, source tokens, customer data, and credentials
never enter receipts or logs.

## Consequences

- #274 can develop deterministic provider mapping without bypassing #273.
- Duplicate calls reuse the same provider idempotency identity.
- Sandbox execution and hosted acceptance remain explicitly incomplete.
- Production hosts, credentials, webhooks, migrations, deployment, and routing
  require later receipt-bound changes and explicit release coordination.
