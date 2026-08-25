# Trello Webhook Function Rules

- Return `200` to `HEAD` without reading configuration or storing evidence.
- Verify `X-Trello-Webhook` over the exact raw body plus configured callback URL.
- Parse and store only after signature verification succeeds.
- Persist no request headers except the non-secret client identifier marker.
- Use `action.id` as the source idempotency key and preserve the full payload.
- Never call Trello or another Edge Function from this webhook handler.
