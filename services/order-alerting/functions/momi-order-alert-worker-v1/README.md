# MoMi Order Alert Worker v1

## ELI5

This worker claims one exact order-event delivery, asks the canonical MoMi order
reader for that order, then records matching delivery work. During dual-run it
also finishes already-created legacy order jobs.

## Identity

- Function key: `momi.orders.alert.evaluate.v1`
- Route: `/functions/v1/momi-order-alert-worker-v1`
- Owner: `order-alerting`
- Boundary: MoMi internal

## Trigger And Input

`POST` accepts exactly one of two inputs; see the input schema:

- `work_id` and `trigger_token` authorize one durable API work row.
- `event_id`, `message_id`, and `capability_token` authorize one exact event
  delivery. No other keys are accepted.

## Output

The response reports one durable work or event-delivery disposition. It never
returns an order payload or capability token.

## Durable Flow

1. Begin only the delivery matching all three event capability fields.
2. Load event metadata through `momi_alerting.stage_order_event_work`; the
   worker never reads a PGMQ batch or accepts queue message content.
3. Acknowledge archived, reconciled, and other non-live events without work.
4. Bridge exact `warehouse.order.observed` idempotently to
   `momi.orders.get_by_id.v1` work.
5. Claim eligible work and record an attempt in `momi_orders`.
6. Resolve its active read contract and one active HTTP route from
   `momi_runtime`.
7. For the canonical route, mint one 30-second read capability scoped to the
   exact order and send its `work_id`, `order_id`, and `capability_token`.
   The legacy route alone receives the alert `work_id` and `trigger_token`.
8. Revoke the canonical read capability before validating the response.
9. Validate identity, the canonical document, provenance, and presentation.
10. Pass both documents to `momi_alerting.claim_order_alert_candidates`, which
   snapshots the presentation on a claimed candidate.
11. Complete and acknowledge, or schedule the exact delivery retry on failure.

Begin, acknowledgement, and failure all require the same event ID, message ID,
and rotating capability token. Acknowledgement deletes only that exact message.

## Side Effects

The worker records an invocation attempt, issues and revokes one scoped read
capability, claims configured alert candidates, snapshots readable presentation
data, and queues configured delivery work. It never logs the read token.

## Failure Handling

Failures finish the attempt, release its work lease, and use the token-fenced
event delivery retry policy. A failed read creates no alert. Retry and lease
reconciliation rotate the delivery capability before another wake.

## Authority Boundary

New event work is fixed to `momi.orders.get_by_id.v1`; its exact owned route is
resolved from runtime configuration and requires an expiring canonical read
capability. The `work_id`/`trigger_token` reader body exists only for legacy
Toast work created before cutover. The worker never reads `toast_raw`, uses a
Toast DTO, or calls a source or destination vendor.

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
