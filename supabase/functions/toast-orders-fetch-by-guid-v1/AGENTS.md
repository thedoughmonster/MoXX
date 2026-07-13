# Toast Order Fetch Function Rules

- This directory owns only `toast.orders.fetch_by_guid.v1`.
- Accept only a durable hydration job identifier from the trigger adapter.
- Resolve every non-secret source parameter from approved database records.
- Call only the configured Toast host and `GET /orders/v2/orders/{guid}`.
- Never accept an arbitrary URL, method, header, or query parameter.
- Persist the complete JSON response before returning success.
- Deduplicate identical resource versions by content hash.
- Persist attempts and safe response metadata without credentials or tokens.
- Authorize POST triggers with the private token on the durable work row.
- Create Order API work only after a valid order resource is durable.
- Do not evaluate alerts, format messages, call Slack, or call another function.
- Log identifiers and generic errors only, never source payloads or secrets.
