# MoMi Order Alert Worker v1

## ELI5

This worker receives a numbered order job, looks up which MoMi order reader is
registered for it, and asks that reader for the exact saved order version. It
then checks the configured alert rules and records any matching delivery work.
It does not care whether the order came from Toast, Square, or a future source.

## Identity

- Function key: `momi.orders.alert.evaluate.v1`
- Route: `/functions/v1/momi-order-alert-worker-v1`
- Owner: `order-alerting`
- Boundary: MoMi internal

## Trigger And Input

`POST` accepts only `work_id` and `trigger_token`; see the input schema. The
token authorizes one durable row in `momi_orders.api_invocation_work`.

## Output

The response reports the durable work disposition and identifiers. It never
returns an order payload or capability token.

## Durable Flow

1. Claim eligible work and record an attempt in `momi_orders`.
2. Resolve its active read contract and one active HTTP route from
   `momi_runtime`.
3. Call that exact same-project route with `work_id`, `order_id`, and the token.
4. Validate identity, the complete payload, and the common presentation.
5. Pass both documents to `momi_alerting.claim_order_alert_candidates`, which
   snapshots the presentation on a claimed candidate.
6. Complete the attempt and work row with the durable decision outcome.
7. On failure, finish the attempt and release the lease even when no upstream
   HTTP status is available.

## Side Effects

The worker records an invocation attempt, claims configured alert candidates,
snapshots readable presentation data, and queues configured delivery work.

## Failure Handling

Failures finish the attempt, record a stable error code, and release the work
lease so configured retry policy can act. A failed read creates no alert.

## Authority Boundary

This function calls only the owned read route registered for its work. The API
contract key and route are configuration, not provider constants. It never
reads raw/source tables and never calls Toast, Square, Slack, or another vendor.
It does not transform the complete provider payload or presentation returned by
the owned API.

## Configuration

- `SUPABASE_DB_URL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEYS` are supplied
  by Supabase.
- `MOMI_CODE_COMMIT_SHA` records the deployed revision with each attempt.
- Order readers, sources, rules, routes, and destinations remain independent
  database configuration.

## Tests

See the [function manifest](function.json), [service rules](../../AGENTS.md),
and [alert pipeline contract](../../../../docs/contracts/momi-order-alert-pipeline-v1.md).
Run `npm run check -- --service order-alerting` from the repository root.
