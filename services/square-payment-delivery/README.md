# Square Payment Delivery
## ELI5
This is the one cashier window allowed to ask Square to charge an order from a
governed MoXi ordering service. The owner's durable payment attempt prevents
duplicates; Dough Monster preorder is the first consumer, not the contract.
## Boundary
The sole outbound Square mutation boundary cannot create orders, choose money,
change quotes, accept raw card data, or own payment truth. Terminal is separate.
This slice executes a bounded Sandbox request through an injected host runtime,
but registers no Edge Function and creates no database, secret, provider
configuration, deployment, or payment effect. Runtime registration remains a
later, separately governed slice.
## Contract
`square.payment.execute.v1` sends the owner-issued attempt as Square idempotency,
the owner-issued order as `reference_id`, and exact configured location and
money. The receipt contains only customer-safe state and provider identity.
## Failure Handling
Payment-method errors decline. HTTP failure, timeout, malformed content,
unknown status, or financial/linkage mismatch stays indeterminate. Timeout and
transport failure require retrieval; callers must never charge blindly again.
## Tests
Focused tests verify exact requests, idempotency, safe outcomes, and recovery.
Run `pnpm check --service square-payment-delivery` with Node.js 24.
