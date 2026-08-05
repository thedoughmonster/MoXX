# Preorder Operations Rules

- Own only the public preorder business lifecycle declared by ADR 0019.
- Expose customer-safe, source-neutral versioned contracts only.
- Never expose a private relation, provider DTO, secret, or arbitrary query.
- Create durable order intent before any paid provider work.
- Treat payment timeout or missing response as indeterminate and reconcile it.
- Fail closed on stale policy, quote, window, and capacity. Admit unverified
  allergen data only when no avoidance is requested; avoidance without evidence
  remains fail closed and must never be represented as safe.
- Keep payment tokens, customer data, and provider payloads out of logs and
  fixtures.
- Realtime may improve experience but cannot be required for correctness.
