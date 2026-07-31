# Square Payment Acquisition
## ELI5
This adapter independently reads one Sandbox payment and proves webhook bytes
came from Square. A changed byte, URL, or signature fails.
## Boundary
This is the sole Square observation boundary. It retrieves known provider
identity but does not create payments, own truth, or update ordering state.
It adds no public webhook, storage, subscription, secret, or hosted behavior.
Later receipt work must archive authenticated evidence, deduplicate provider
event identity, and acknowledge transport separately from reconciliation.
Correctness never depends on webhook delivery.
## Tests
Focused tests verify retrieval identity, missing and mismatched payments,
transport ambiguity, and exact raw-byte signature authentication.
Run `pnpm check --service square-payment-acquisition` with Node.js 24.
