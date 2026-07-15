# `momi-event-router-v1`

## ELI5

The router reads one event note and makes one durable copy for every service
that subscribed to that kind of note.

## Trigger And Input

- Function key: `momi.events.route.v1`
- Route: `/functions/v1/momi-event-router-v1`
- Input: one event UUID and its durable capability token
- Output: accepted, duplicate, routed, or retrying disposition

The worker claims a 120-second lease and calls only private database functions.
Messages include `event_id`, canonical entity identity, occurrence time, schema
version, source reference, and correlation ID. Source payloads never enter PGMQ.
One archived stock response is represented by one snapshot event rather than a
message for each item in that response.

`GET` is a health check. `POST` performs routing. The gateway invokes it from a
database wake-up adapter after the event and routing work are committed.

## Output

The response identifies the event, reports routed or duplicate disposition, and
includes only the subscriber delivery count.

## Side Effects

The worker creates idempotent delivery rows, sends reference-only queue
messages, and completes or reschedules durable routing work.

## Failure Handling

Failures retain the event in exponential retry state. After 12 failed leases,
the database marks routing dead-lettered for operator recovery.

## Tests

Tests reject malformed identities and extra payload fields. Run `pnpm check`
from the repository root.
