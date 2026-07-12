# MoMi Backend

Source-controlled backend services and database history for MoMi.

## Current Modules

`toast-orders-webhook-ingest-v1` receives Toast Orders webhook events,
verifies Toast's signature, and preserves the complete event in Postgres.
The hosted path was verified with signed in-store lifecycle events on
2026-07-12.

The private `toast_alerting` schema defines independently controlled sources,
rules, routes, Slack destinations, and durable alert candidates. Configuration
is disabled by default and contains no hardcoded business values.

Slack formatting and delivery will be implemented as a separate module. It
must not run inside the raw ingestion request.

## Module Boundaries

- Ingestion authenticates and preserves source records.
- Eligibility evaluates stored records using database configuration.
- Delivery owns Slack formatting, retries, and delivery status.
- Cross-source projections use explicit database views and contracts.

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
subscription. It must never be committed to this repository.

## Verification

Run `npm test` with Node.js 24. Hosted verification uses a controlled
Toast event or Toast's event replay action after deployment.
