# Toast Stock Ingest Rules

- Own only Toast stock webhook authentication and complete event persistence.
- Verify `Toast-Signature` against the exact body and payload timestamp.
- Store the complete payload and exact signed body before acknowledging it.
- Never persist request headers or authentication material.
- Treat the payload event GUID as the replay idempotency key.
- Accept only Toast `stock` events for menu item inventory changes.
- Never call Toast, Slack, another Edge Function, or another outbound API.
- Never map, normalize, interpret, or alert on inventory state here.
- Log generic persistence failures only, never payloads or secrets.
