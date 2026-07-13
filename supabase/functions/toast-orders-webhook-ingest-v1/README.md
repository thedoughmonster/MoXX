# Toast Orders Webhook Ingest v1

## ELI5

Toast sends MoMi a signed note that an order changed. This function checks the
signature, saves the entire note exactly once, and stops. The database decides
whether any later fetching or alert work should happen.

## Purpose

This public inbound adapter authenticates Toast Orders webhook events and
preserves each complete source event before any downstream work begins.

- Function key: `toast.orders.webhook_ingest.v1`
- Route: `/functions/v1/toast-orders-webhook-ingest-v1`
- Boundary: Toast inbound

## HTTP Contract

`GET` is a health check. `POST` accepts the Toast event JSON and requires a
valid `Toast-Signature` over the exact request body plus its timestamp.
Supabase gateway JWT verification is disabled because Toast authentication is
implemented by this function.

The payload and response schemas live in `contracts/`. The input schema permits
additional fields so no Toast-owned data is discarded.

## Durable Flow

1. Read the exact body and validate the required event envelope.
2. Verify the Toast HMAC signature.
3. Insert headers and the complete payload into
   `toast_raw.order_webhook_events`.
4. Let the database trigger evaluate mappings and queue qualifying hydration.

The event GUID makes a replay idempotent. A duplicate is acknowledged without
creating another raw event or hydration job.

## Authority Boundary

This function may authenticate and persist inbound Toast events. It never calls
Toast, the MoMi Order API, Slack, or another Edge Function, and it performs no
eligibility or delivery decision.

## Configuration

- `TOAST_ORDERS_WEBHOOK_SECRET`: Toast webhook signing secret.
- `SUPABASE_DB_URL`: private database connection supplied by Supabase.
- Source, restaurant, event, and hydration mappings live in database config.

See the [function manifest](function.json), [local rules](AGENTS.md), and
[webhook contract](../../../docs/contracts/toast-orders-webhook-ingest-v1.md).
Run `npm test` from the repository root with Node.js 24.
