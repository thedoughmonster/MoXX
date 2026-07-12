# Hydrated Alert Worker Rules

- Start only from `toast_hydration.order_api_invocation_work`.
- Authorize with the matching per-work capability token.
- Call only `momi-orders-get-by-guid-v1` under ADR `0004`.
- Never query a raw table or approved order view directly.
- Pass the complete API order document only to the configured database claim.
- Record every attempt before returning and never perform Slack delivery.
