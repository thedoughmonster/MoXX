# MoMi Backend

Source-controlled backend services and database history for MoMi.

## Current Services

`toast-orders-webhook-ingest-v1` receives Toast Orders webhook events,
verifies Toast's signature, and preserves the complete event in Postgres.
The hosted path was verified with signed in-store lifecycle events on
2026-07-12.

`toast-orders-fetch-by-guid-v1` hydrates durable order work from Toast and
stores the complete response before downstream use.
`momi-toast-orders-get-by-id-v1` returns the complete Toast document and its
view-derived, source-neutral order presentation.
`momi-order-alert-worker-v1` evaluates any configured owned order response,
and `slack-order-alert-delivery-v1` sends readable, GUID-free durable outcomes.

Private `momi_runtime`, `momi_orders`, and `momi_alerting` schemas own shared
registries, source-neutral order work, independently controlled sources, rules,
routes, destinations, and durable alert outcomes. Configuration is
environment-owned and migrations contain no hardcoded business values.

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
- Source-specific MoMi readers return complete owned warehouse documents.
- Source-neutral eligibility evaluates those documents using configuration.
- Delivery owns Slack formatting, retries, and delivery status.
- Cross-source projections use explicit database views and contracts.
- Supabase-native trigger adapters may wake allowlisted Edge Functions only
  from committed durable work.
- The only internal HTTP hop is the alert worker calling the exact owned reader
  recorded on durable work and resolved through the active function registry.

## Repository Map

- `AGENTS.md`: non-negotiable engineering constraints.
- `docs/service-catalog.md`: generated capability and function inventory.
- `docs/`: shared architecture, decisions, and module contracts.
- `services/<service-key>/`: capability-owned code, contracts, tests, and docs.
- `supabase/migrations/`: reviewed database changes.
- `supabase/functions/<function-slug>/`: thin Edge Function deployment adapters.
- `packages/<package-name>/`: explicitly approved shared code only.
- `local-tools/`: private manual operator tooling that is never deployed.
- `schemas/`: machine-readable workspace and manifest contracts.
- `scripts/`: manifest-driven checks, inventory, and deployment orchestration.
- `tests/`: contract tests that require no local Supabase stack.

## Branches

- `dev` deploys to the persistent Supabase development branch.
- `prod` deploys to the production Supabase project.
- Production changes flow from reviewed and verified development changes.

See [deployment](docs/deployment.md) for the exact commands, credential
boundaries, inventory gate, and exact-commit promotion process.

## Required Hosted Secret

`TOAST_ORDERS_WEBHOOK_SECRET` must contain the secret for the Orders webhook
subscription. `TOAST_CLIENT_ID` and `TOAST_CLIENT_SECRET` authenticate the
dedicated Toast source function. `SLACK_BOT_TOKEN` authorizes the destination
adapter, and `MOMI_CODE_COMMIT_SHA` records the deployed revision on attempts.
These values must never be committed.

## Verification

Run `npm run check -- --service all` with Node.js 24. Hosted verification uses
a controlled Toast event or Toast's event replay action after deployment.
