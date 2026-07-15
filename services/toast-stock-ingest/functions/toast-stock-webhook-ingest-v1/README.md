# Toast Stock Webhook Ingest v1

## ELI5

Toast sends a stock update. MoMi checks the signature and saves the whole
message, once.

## Purpose

This public inbound adapter authenticates Toast Stock webhook events and
preserves each complete source event before any inventory logic exists.

- Function key: `toast.stock.webhook_ingest.v1`
- Route: `/functions/v1/toast-stock-webhook-ingest-v1`
- Owner: `toast-stock-ingest`
- Boundary: Toast inbound

## Trigger And Input

`GET` is a health check. `POST` accepts Toast `stock` event JSON and requires a
valid `Toast-Signature` over the exact request body plus its timestamp.
Supabase gateway JWT verification is disabled because Toast authentication is
implemented by this function.

The payload and response schemas live in `contracts/`. The input schema permits
additional fields so no Toast-owned data is discarded.

## Output

Successful POST responses return JSON with `ok: true` and whether the event was
`stored` or already a `duplicate`.

## Durable Flow

1. Read the exact body and validate the stock event envelope.
2. Verify the Toast HMAC signature.
3. Insert the complete payload and exact signed body into `toast_raw` without
   retaining request headers.

The event GUID makes a replay idempotent. A duplicate is acknowledged without
creating another raw event row.

## Side Effects

The only side effect is inserting the complete event.

## Failure Handling

Malformed payloads return `400`, invalid signatures return `401`, unsupported
methods return `405`, missing runtime configuration returns `503`, and
persistence failures return `500` so Toast can retry.

## Authority Boundary

This function may authenticate and persist inbound Toast stock events. It never
calls Toast, Slack, another Edge Function, or another outbound API, and it
performs no inventory or delivery decision.

## Configuration

- `TOAST_STOCK_WEBHOOK_SECRET`: Toast stock webhook signing secret.
- `SUPABASE_DB_URL`: private database connection supplied by Supabase.

## Tests

See the [function manifest](function.json), [service rules](../../AGENTS.md),
and [webhook contract](../../../../docs/contracts/toast-stock-webhook-ingest-v1.md).
Run `npm run check -- --service toast-stock-ingest` from the repository root.
