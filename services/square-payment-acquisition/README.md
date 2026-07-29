# Square Payment Acquisition

## ELI5

This adapter independently reads one payment from Square Sandbox and checks
that a payment update really came from Square. A changed byte, wrong URL, or
wrong signature fails.

## Boundary

This is the sole Square payment observation boundary. It may retrieve one known
payment by provider identity but does not create payments, own financial truth,
or update preorder state. The current issue #274 slice contains pure Sandbox
retrieval and exact-byte signature verification with tests. It adds no public
webhook, storage, provider
subscription, secret value, or hosted behavior.

Later webhook receipt work must archive authenticated evidence durably,
deduplicate provider event identity, and acknowledge transport separately from
business reconciliation. Reconciliation remains correct without webhook
delivery.

## Tests

Run `pnpm check --service square-payment-acquisition` with Node.js 24.
