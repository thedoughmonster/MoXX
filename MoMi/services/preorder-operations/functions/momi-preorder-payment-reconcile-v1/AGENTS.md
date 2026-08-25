# Payment Reconciliation Invariants

- Retrieve only the provider payment identity returned by a valid owner claim.
- Never create, retry, or replace a provider payment.
- Project missing, mismatched, or ambiguous evidence fail closed.
- Return only the customer-safe durable receipt.
