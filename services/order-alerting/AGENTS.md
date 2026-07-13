# Order Alerting Rules

- Stay source-neutral and start only from durable order API work.
- Authorize with the matching per-work capability token.
- Resolve the exact active reader contract and route from runtime configuration.
- Call only that same-origin owned reader with work and order identity.
- Validate reader identity, complete payload, and common presentation.
- Never read raw source tables or call Toast, Square, Slack, or another vendor.
- Persist attempts, alert claims, presentation snapshots, and delivery work.
- Keep alert identity source-system, order-id, and alert-kind based.
- Never log work tokens or order payloads.
