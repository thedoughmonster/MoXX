# Toast Webhooks Ingest v1

## ELI5

This endpoint opens a Toast notice only when the matching subscription secret
proves it is genuine, then files the complete notice exactly once.

## Trigger And Input

- `GET /functions/v1/toast-webhooks-ingest-v1` is a health probe.
- `POST /functions/v1/toast-webhooks-ingest-v1` accepts Toast's standard JSON
  webhook body and `Toast-Signature` header.
- Menus accepts `menus/menus_updated`.
- Packaging accepts `packaging/packaging_updated` and
  `partner/packaging_updated`.
- Restaurant availability accepts online and offline types for both
  `restaurant_availability` and `restaurant_availability_toggle`.
- Ordering schedule accepts
  `ordering_schedule/ordering_schedule_updated`.

The signature is HMAC-SHA256 over the exact body followed by the payload
timestamp. Its key comes from the secret assigned to the matched subscription.

## Output

Health checks return `{ "ok": true }`. A stored POST returns `ok: true` with a
`stored` disposition. Re-delivery of an existing event GUID returns the same
success shape with a `duplicate` disposition.

## Side Effects

One complete envelope is attempted in `toast_raw.webhook_events`. It includes
the source event GUID, matched subscription, category, type, restaurant GUID
when present, generated correlation ID, all received headers, complete parsed
payload, SHA-256 hash of the exact body, and handler version. No network calls
or business logic occur.

## Failure Handling

- Invalid JSON or an unregistered category/type pair returns `400`.
- A missing runtime secret returns `503`.
- A missing, malformed, or incorrect signature returns `401`.
- Unsupported methods return `405`.
- Durable storage failure returns `500` and logs only event identity and the
  error name.

## Tests

Tests exercise valid and invalid signatures, both packaging categories, both
availability categories, rejected categories and types, exact-body hashing,
database duplicate disposition, and successful replay.

## Configuration And Authority

`SUPABASE_DB_URL` supplies the direct database connection. Each subscription
secret is declared separately in the service manifest. The function may write
`toast_raw` and has no outbound host authority.
