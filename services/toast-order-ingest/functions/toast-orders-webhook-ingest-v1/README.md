# Toast Orders Webhook Ingest v1

## ELI5

Toast sends MoMi a signed note that an order changed. This function checks the
signature and saves the entire note exactly once. The database can then hand
the complete saved order to alerting without fetching it again.

## Purpose

This public inbound adapter authenticates Toast Orders webhook events and
preserves each complete source event before any downstream work begins.

- Function key: `toast.orders.webhook_ingest.v1`
- Route: `/functions/v1/toast-orders-webhook-ingest-v1`
- Owner: `toast-order-ingest`
- Boundary: Toast inbound

## Trigger And Input

`GET` is a health check. `POST` accepts the Toast event JSON and requires a
valid `Toast-Signature` over the exact request body plus its timestamp.
Supabase gateway JWT verification is disabled because Toast authentication is
implemented by this function.

The payload and response schemas live in `contracts/`. The input schema permits
additional fields so no Toast-owned data is discarded.

## Output

Successful responses acknowledge whether the event was stored or was an
idempotent duplicate. They never return the source payload.

## Durable Flow

1. Read the exact body and validate the required event envelope.
2. Verify the Toast HMAC signature.
3. Insert headers and the complete payload into
   `toast_raw.order_webhook_events`.
4. Let the database trigger evaluate mappings and create qualifying owned
   order alert work from the stored event.

The event GUID makes a replay idempotent. A duplicate is acknowledged without
creating another raw event or alert work row.

## Side Effects

The only direct side effect is inserting the complete event and headers. A
database trigger may then create durable owned alert work from configuration.

## Failure Handling

Invalid payloads or signatures are rejected before storage. Missing runtime
configuration returns unavailable, and persistence failures are logged without
payloads or secrets so Toast can retry.

## Authority Boundary

This function may authenticate and persist inbound Toast events. It never calls
Toast, the MoMi Order API, Slack, or another Edge Function, and it performs no
eligibility or delivery decision.

## Configuration

- `TOAST_ORDERS_WEBHOOK_SECRET`: Toast webhook signing secret.
- `SUPABASE_DB_URL`: private database connection supplied by Supabase.
- Source, restaurant, event, and owned-reader mappings live in database config.

## Tests

See the [function manifest](function.json), [service rules](../../AGENTS.md),
and [webhook contract](../../../../docs/contracts/toast-orders-webhook-ingest-v1.md).
Run `npm run check -- --service toast-order-ingest` from the repository root.
