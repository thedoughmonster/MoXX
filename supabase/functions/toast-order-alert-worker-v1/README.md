# Hydrated Toast Order Alert Worker v1

## Purpose

This decision worker evaluates one hydrated order against configured alert
rules and creates durable delivery work when a route matches.

- Function key: `toast.orders.alert_from_hydrated_order.v1`
- Route: `/functions/v1/toast-order-alert-worker-v1`
- Boundary: MoMi internal

## HTTP Contract

`POST` accepts only `work_id` and its `trigger_token`; see
`contracts/input.schema.json`. The token authorizes one durable Order API work
row. Gateway JWT verification is disabled; the publishable key permits entry to
the owned API while the per-work token supplies authorization.

## Durable Flow

1. Claim eligible Order API invocation work and record an attempt.
2. Call only `/functions/v1/momi-orders-get-by-guid-v1` with source identity.
3. Validate the owned API response without transforming its complete payload.
4. Pass that document to the configured database claim operation.
5. Record the decision outcome; a matching candidate queues Slack delivery.

## Authority Boundary

This function may call only the versioned MoMi Order API allowed by ADR `0004`.
It never calls Toast or Slack and never reads raw tables or order views directly.

## Configuration

- `SUPABASE_DB_URL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEYS` are supplied
  by Supabase.
- `MOMI_CODE_COMMIT_SHA` records the deployed revision with each attempt.
- Sources, rules, routes, and destinations remain independent database config.

See the [function manifest](function.json), [local rules](AGENTS.md), and
[alert pipeline contract](../../../docs/contracts/toast-order-alert-pipeline-v1.md).
Run `npm test` from the repository root with Node.js 24.
