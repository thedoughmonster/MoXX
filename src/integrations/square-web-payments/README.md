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

## Downstream activation dependency

The preorder UI owner must wire the adapter to an authoritative order/payment
attempt, provide the two public `VITE_SQUARE_SANDBOX_*` identifiers, and add the
current Square Sandbox CSP allowlist at the hosting boundary before rendering
the card element. Payment execution remains disabled until the backend's active
preorder configuration and durable payment-attempt gates are satisfied.

The SDK URL and browser flow follow Square's Web Payments SDK documentation:

- <https://developer.squareup.com/docs/web-payments/overview>
- <https://developer.squareup.com/docs/web-payments/take-card-payment>
- <https://developer.squareup.com/docs/web-payments/content-security-policy>
