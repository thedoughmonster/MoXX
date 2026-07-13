# Toast Orders Webhook Ingest Rules

- This directory owns only `toast.orders.webhook_ingest.v1`.
- Accept only the unauthenticated health check and signed Toast webhook POST.
- Verify `Toast-Signature` against the exact body and payload timestamp.
- Store the complete parsed payload and received headers before acknowledging.
- Treat the payload event GUID as the replay idempotency key.
- Let the database trigger queue only configured durable hydration work.
- Never call Toast, Slack, another Edge Function, or any downstream API.
- Never map, normalize, or interpret order state inside this function.
- Log generic persistence failures only, never source payloads or secrets.
