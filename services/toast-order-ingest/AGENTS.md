# Toast Order Ingest Rules

- Own only Toast order webhook authentication and complete event persistence.
- Verify `Toast-Signature` against the exact body and payload timestamp.
- Store the complete payload and exact signed body before acknowledging it.
- Never persist request headers or authentication material.
- Treat the payload event GUID as the replay idempotency key.
- Let committed database work hand the saved complete order to owned alerting.
- Never queue GET-by-GUID hydration from a webhook event.
- Never call Toast, Slack, another Edge Function, or another outbound API.
- Never map, normalize, or interpret order state here.
- Log generic persistence failures only, never payloads or secrets.
