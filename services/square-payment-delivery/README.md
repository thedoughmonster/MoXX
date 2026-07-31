# Square Payment Delivery
## ELI5
This is the one cashier window allowed to ask Square to charge an order from a
governed MoXi ordering service. The owner's durable payment attempt prevents
duplicates; Dough Monster preorder is the first consumer, not the contract.
## Boundary
The sole outbound Square mutation boundary cannot create orders, choose money,
change quotes, accept raw card data, or own payment truth. Terminal is separate.
This service executes bounded payment and refund requests through an injected
Sandbox host runtime, but registers no independently callable Edge Function.
The Logic owner must claim a durable command before invoking it and project the
returned financial evidence before reporting success.
## Contract
`square.payment.execute.v1` sends the owner-issued attempt as Square idempotency,
the owner-issued order as `reference_id`, and exact configured location and
money. `square.payment.refund.v1` accepts only an owner-issued durable refund
command and uses that identity as the refund idempotency key. Receipts contain
only sanitized provider facts.
## Browser tokenization handoff
MoXi renders Square Web Payments SDK card fields inline in its own checkout.
The public Sandbox application and location identifiers initialize those
Square-hosted fields; no access token or raw card value enters MoXi. The browser
uses `Card.tokenize` with charge, customer-initiated, and non-keyed-in
verification details, then posts only the resulting single-use source token to
the Logic-owned payment initiation contract. A bank-required 3-D Secure
challenge may overlay the page, but payment never redirects to Square Checkout.
Only a provider payment carrying exact identity, money, location, status, and
## Failure Handling
update time can become matched evidence. HTTP failure, timeout, malformed
content, missing identity, unknown status, or linkage mismatch stays
indeterminate. Callers must reconcile by known provider identity and never
repeat a charge blindly.
## Tests
Focused tests verify exact requests, idempotency, safe outcomes, and recovery.
Run `pnpm check --service square-payment-delivery` with Node.js 24.
