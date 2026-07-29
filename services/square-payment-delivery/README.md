# Square Payment Delivery

## ELI5

This adapter is the one cashier window allowed to ask Square to charge an
already-created Dough Monster preorder. It uses the preorder payment attempt as
the duplicate-prevention key and returns a small safe receipt.

## Boundary

The adapter is the sole outbound Square Payments API destination adapter. It
does not own preorder, payment, or financial truth. It cannot create a MoMi
order, choose an amount, change a quote, accept raw card data, or implement
Square Terminal.

The current issue #274 slice is deliberately non-hosted. It freezes and tests
the Sandbox request mapping and customer-safe result classification. No Edge
Function, database object, secret value, provider configuration, or payment is
created by this slice. Runtime activation must wait for issue #273 to provide a
durable order and payment-attempt claim before paid provider work.

## Contract

`square.payment.execute.v1` maps the stable payment-attempt ID to Square's
idempotency key, the MoMi order ID to the provider reference, and exact minor
units/currency to the payment request. Independent retrieval belongs to
`square-payment-acquisition`. Receipts are sanitized.

## Failure Handling

Payment-method errors are declined. Timeouts, rate limits, provider failures,
malformed responses, unknown statuses, and financial/linkage mismatches are
indeterminate. They never become paid or permission for a new paid attempt.

## Tests

Run `pnpm check --service square-payment-delivery` with Node.js 24.
