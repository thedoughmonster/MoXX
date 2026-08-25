# Square Web Payments browser adapter

This provider-only module mounts Square's Sandbox card fields inside a caller-
owned page element and hands one single-use source token directly to an injected
callback. It never creates a payment, owns an order state, stores a token, logs
provider errors, or returns a token in its result.

## Consumer contract

1. Read the public Sandbox application and location IDs with
   `readSquareSandboxConfig(import.meta.env)`.
2. Load the fixed Sandbox SDK through a secure context with
   `loadSquareSandboxSdk(createSquareBrowserScriptHost())`.
3. Mount the Square card element into an empty, accessible checkout container.
4. Pass the owner-authoritative amount, currency, and customer-initiated charge
   details to `tokenizeAndHandoff`.
5. In the callback, send the token directly to the accepted Logic-owned payment
   initiation route. Do not copy it into state, storage, telemetry, errors, or a
   retry queue.
6. If handoff is indeterminate, use Logic-owned status/reconciliation. The
   adapter deliberately blocks another tokenization from that card instance.

`SquareWebPaymentsBoundary` validates the two public Sandbox identifiers once
at the app root. `SquarePaymentPanel` remains inactive until its caller supplies
an owner-authoritative payment-initiation command key, amount, currency, and
handoff callback. A changed initiation key remounts the one-use card session
rather than reusing a consumed or indeterminate tokenization session. The
backend creates the durable payment attempt atomically with that direct token
handoff; the browser does not manufacture an attempt in advance.
Inactive or missing configuration never loads Square's SDK or renders a submit
action.

## Downstream activation dependency

The app root now provides the validated public configuration, and the governed
development preview has a host-scoped Square Sandbox CSP contract in
`public/_headers`. The preorder UI owner must place `SquarePaymentPanel` only
after an authoritative unpaid order exists and hand its token directly to the
accepted Logic initiation route. The payment attempt is created within that
one-use request. Payment execution remains disabled until the backend's active
preorder configuration and durable order gates
are satisfied.

The SDK URL and browser flow follow Square's Web Payments SDK documentation:

- <https://developer.squareup.com/docs/web-payments/overview>
- <https://developer.squareup.com/docs/web-payments/take-card-payment>
- <https://developer.squareup.com/docs/web-payments/content-security-policy>
