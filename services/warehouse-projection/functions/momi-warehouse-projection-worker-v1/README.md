# MoMi Warehouse Projection Worker v1

## ELI5

This worker claims one named saved-event delivery and asks the database to copy
the referenced Toast facts into MoMi's warehouse.

## Identity

- Function key: `momi.warehouse_projection.toast.consume.v1`
- Route: `/functions/v1/momi-warehouse-projection-worker-v1`
- Owner: `warehouse-projection`
- Boundary: MoMi internal

## Trigger And Input

`POST` requires exactly `event_id`, `message_id`, and the delivery row's
`capability_token`. `GET` is health only.

## Output

The response reports the exact event/message identity and its projection,
retry, dead-letter, duplicate, or failed outcome.

## Durable Flow

1. Claim the exact event/message/token with `momi_events.begin_delivery`.
2. Re-read and validate the source event in `momi_events.events`.
3. Call `warehouse_projection.project_toast_event(event_id)`.
4. Acknowledge projected, acquisition, and explicit `ignored_*` outcomes.
5. Fail the same token-bound delivery for every processing failure.

## Side Effects

The worker changes delivery state, projects canonical warehouse records, may
enqueue database-owned acquisition reconciliation, and may enqueue a dead
letter after the database retry limit is reached.

## Failure Handling

Malformed references, missing or mismatched events, projector errors, and
unexpected outcomes are failed durably. The database chooses `retry_wait`,
`dead_letter`, or `not_found`; unresolved failures remain visible in results.

## Authority Boundary

The worker has database access only. It makes no source network calls, imports
no Toast client, and requires neither Toast credentials nor source payloads.
Unknown source categories succeed only when the projector returns an explicit
`ignored_*` result.

## Configuration

`SUPABASE_DB_URL` supplies the private Postgres connection. The database-owned
delivery capability authenticates and scopes each wake.

## Tests

Tests cover stale capabilities, exact delivery identity, projection success,
explicit ignored outcomes, retry, and dead-letter results. Run
`npm run check -- --service warehouse-projection` from the repository root.
