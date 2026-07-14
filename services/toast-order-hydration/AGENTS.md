# Toast Order Hydration Rules

- Start only from durable hydration work and verify its private trigger token.
- Do not treat order webhooks as automatic GET-by-GUID hydration requests.
- Resolve non-secret source parameters from approved database records.
- Call only the configured Toast host and exact GET-by-GUID operation.
- Never accept an arbitrary URL, method, header, or query parameter.
- Store the complete response before creating downstream work.
- Deduplicate resource versions by content hash while retaining attempts.
- Keep hydration and re-hydration idempotent and warehouse-backed.
- Never evaluate alerts, format messages, call Slack, or call another function.
- Log identifiers and generic errors only, never payloads or credentials.
