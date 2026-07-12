# MoMi Toast Ingest

Source-controlled ingestion services for Toast data used by MoMi.

## Current Slice

`toast-orders-webhook-ingest-v1` receives Toast Orders webhook events,
verifies Toast's signature, and preserves the complete event in Postgres.
The hosted path was verified with signed in-store lifecycle events on
2026-07-12.

The current slice intentionally does not:

- Format or send Slack messages.
- Decide which order state should trigger an alert.
- Normalize Toast order objects into relational tables.
- Join Toast data to any other source.

## Repository Map

- `AGENTS.md`: non-negotiable engineering constraints.
- `docs/`: architecture, decisions, and behavior contracts.
- `supabase/migrations/`: reviewed database changes.
- `supabase/functions/`: one directory per callable function.
- `tests/`: pure contract tests that require no local Supabase stack.

## Required Hosted Secret

`TOAST_ORDERS_WEBHOOK_SECRET` must contain the secret for the Orders webhook
subscription. It must never be committed to this repository.

## Verification

Run `npm test` with Node.js 22 or newer. Hosted verification uses a controlled
Toast event or Toast's event replay action after deployment.
