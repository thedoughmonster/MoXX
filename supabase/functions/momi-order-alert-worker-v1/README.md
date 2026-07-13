# MoMi Order Alert Worker v1

## ELI5

This worker receives a numbered order job, looks up which MoMi order reader is
registered for it, and asks that reader for the exact saved order version. It
then checks the configured alert rules and records any matching delivery work.
It does not care whether the order came from Toast, Square, or a future source.

## Identity

- Function key: `momi.orders.alert.evaluate.v1`
- Route: `/functions/v1/momi-order-alert-worker-v1`
- Owner: `momi-order-alert-worker`
- Boundary: MoMi internal

## HTTP Contract

`POST` accepts only `work_id` and `trigger_token`; see the input schema. The
token authorizes one durable row in `momi_orders.api_invocation_work`.

## Durable Flow

1. Claim eligible work and record an attempt in `momi_orders`.
2. Resolve its active read contract and one active HTTP route from
   `momi_runtime`.
3. Call that exact same-project route with `work_id`, `order_id`, and the token.
4. Validate contract, source, order, location, and version identity.
5. Pass the complete payload to `momi_alerting.claim_order_alert_candidates`.
6. Complete the attempt and work row with the durable decision outcome.

## Authority Boundary

This function calls only the owned read route registered for its work. The API
contract key and route are configuration, not provider constants. It never
reads raw/source tables and never calls Toast, Square, Slack, or another vendor.
It does not transform the complete provider payload returned by the owned API.

## Configuration

- `SUPABASE_DB_URL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEYS` are supplied
  by Supabase.
- `MOMI_CODE_COMMIT_SHA` records the deployed revision with each attempt.
- Order readers, sources, rules, routes, and destinations remain independent
  database configuration.

See the [function manifest](function.json), [local rules](AGENTS.md), and
[alert pipeline contract](../../../docs/contracts/momi-order-alert-pipeline-v1.md).
Run `npm test` from the repository root with Node.js 24.
