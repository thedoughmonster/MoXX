# Order Alert Worker Rules

- This directory owns only `momi.orders.alert.evaluate.v1`.
- The owning service is `momi-order-alert-worker`; keep it source-neutral.
- Start only from `momi_orders.api_invocation_work`.
- Authorize with the matching per-work capability token.
- Resolve the work's active read contract and exact HTTP route from
  `momi_runtime` registries; never hardcode a provider contract or route.
- Call only that same-origin owned API with `work_id`, `order_id`, and the token.
- Validate identity, payload, and source-neutral presentation before use.
- Never read raw/source tables or call Toast, Square, Slack, or another vendor.
- Pass the complete API document and presentation only to
  `momi_alerting.claim_order_alert_candidates`.
- Record every attempt in `momi_orders` before returning.
- Never log work tokens or order payloads.
