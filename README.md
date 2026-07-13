# MoMi Backend

Source-controlled backend services and database history for MoMi.

## Current Modules

`toast-orders-webhook-ingest-v1` receives Toast Orders webhook events,
verifies Toast's signature, and preserves the complete event in Postgres.
The hosted path was verified with signed in-store lifecycle events on
2026-07-12.

`toast-orders-fetch-by-guid-v1` hydrates durable order work from Toast and
stores the complete response before downstream use. `momi-orders-get-by-guid-v1`
is the owned warehouse read boundary. `toast-order-alert-worker-v1` evaluates
hydrated orders, and `slack-order-alert-delivery-v1` sends durable outcomes.

The private `toast_alerting` schema defines independently controlled sources,
rules, routes, Slack destinations, and durable alert candidates. Configuration
is environment-owned and migrations contain no hardcoded business values.

## Source Ownership

The Toast webhook is retained unchanged as its own source record. It is not a
substitute for the complete order returned by the Toast Orders API.

For the first order-alert slice, `toast.orders.fetch_by_guid.v1` is the only
primitive source function permitted to call Toast. It accepts durable work,
implements one explicit Toast operation, and is not a generic API proxy.

Fetched records are permanent, source-faithful resource versions in
resource-specific `toast_raw` tables. `toast_raw.orders` receives complete
order JSONB from GET-by-GUID and any later approved bulk order operation.
Identical content is deduplicated by hash while small fetch-attempt metadata is
retained separately.

Related and query-oriented projections must be rebuildable from owned raw
resource versions with Toast unavailable. This is required because Toast will
eventually be replaced by Square; Toast access cannot be a recovery strategy.

## Module Boundaries

- Ingestion authenticates and preserves source records.
- Primitive source functions alone acquire vendor data for durable work.
- Eligibility evaluates hydrated records using database configuration.
- Delivery owns Slack formatting, retries, and delivery status.
- Cross-source projections use explicit database views and contracts.
- Supabase-native trigger adapters may wake allowlisted Edge Functions only
  from committed durable work; modules do not coordinate through HTTP chains.

## Repository Map

- `AGENTS.md`: non-negotiable engineering constraints.
- `docs/`: shared architecture, decisions, and module contracts.
- `supabase/migrations/`: reviewed database changes.
- `supabase/functions/<service-name>/`: one directory per Edge service.
- `services/<service-name>/`: one directory per future non-Edge service.
- `packages/<package-name>/`: shared non-deployable code only.
- `tests/`: contract tests that require no local Supabase stack.

## Branches

- `dev` deploys to the persistent Supabase development branch.
- `prod` deploys to the production Supabase project.
- Production changes flow from reviewed and verified development changes.

## Required Hosted Secret

`TOAST_ORDERS_WEBHOOK_SECRET` must contain the secret for the Orders webhook
subscription. `TOAST_CLIENT_ID` and `TOAST_CLIENT_SECRET` authenticate the
dedicated Toast source function. These values must never be committed.

## Verification

Run `npm test` with Node.js 24. Hosted verification uses a controlled
Toast event or Toast's event replay action after deployment.
