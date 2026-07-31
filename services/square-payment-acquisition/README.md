# Square Payment Acquisition
## ELI5
This adapter independently reads one Sandbox payment and authenticates payment
and refund webhooks over the exact configured URL and raw bytes. A changed byte,
URL, or signature fails before parsing.
## Boundary
This is the sole Square observation boundary. It retrieves known provider
identity but does not create payments, own truth, or update ordering state.
It emits only sanitized canonical observations and financial evidence. Refund
events retrieve their known payment to recover MoXi order linkage and fail
closed on partial or mismatched money. It adds no public webhook, storage,
subscription, secret, or hosted behavior; the Logic-owned handler resolves and
projects authenticated evidence. Correctness never depends on webhook delivery.
## Tests
Focused tests verify retrieval identity, missing and mismatched payments,
transport ambiguity, and exact raw-byte signature authentication.
Run `pnpm check --service square-payment-acquisition` with Node.js 24.
