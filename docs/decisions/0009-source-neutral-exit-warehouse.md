# 0009: Source-Neutral Exit Warehouse

- Status: accepted
- Date: 2026-07-14
- Supersedes: the source-specific reader direction in 0003

## Context

Dough Monster plans to leave Toast. Operational services must keep working when
another point-of-sale system becomes active, and the historical archive must be
reconstructable without continued vendor access.

Source DTOs and IDs had reached the order alert read contract. Independent
pollers would also repeat API calls, consume rate limits, and leave uneven raw
history. Webhooks alone do not cover payments, cash, labor, configuration,
kitchen, devices, or historical reconciliation.

## Decision

Toast names and schemas stop at three source boundaries:

1. `toast-webhook-ingestion` authenticates and stores complete inbound events.
2. `toast-data-acquisition` is the only Toast credential holder and caller.
3. `toast_raw` stores exact source attempts, responses, versions, and observations.

`momi-event-routing` stores append-only `source.toast.*` and `warehouse.*` event
metadata, then sends reference-only messages to one private PGMQ queue per
subscriber. Delivery is at-least-once with a 120-second lease, exponential
retry from 15 seconds to one hour, and dead-lettering after 12 attempts.

Warehouse projections assign stable DM UUIDs. A source crosswalk maps any
vendor's resource key to a DM entity, so Toast and a successor can describe the
same location, item, employee, or other entity. Canonical versions keep
provenance and freshness but never require a source DTO or source identifier.

`warehouse-read-api` is a core capability. Versioned `momi.*` contracts expose
canonical orders, payments, menu entities, employees, schedules, and stock
observations. Exact source reconstruction remains a privileged archive concern.

The durable event command and queue envelope contain identity and references,
not source payloads. Business services may subscribe only to `warehouse.*`.

## Compatibility

`momi.toast_orders.get_by_id.v1` remains during migration.
`momi.orders.get_by_id.v1` is the replacement. Order alerting moves to canonical
order events and the new reader before the old source reader is retired.

## Scheduling

Database configuration owns capture windows and cadence. Online ordering hours
plus buffers determine live polling. Cron creates or reconciles durable work;
`pg_net` only wakes exact registered workers after work is committed.

## Consequences

Raw and canonical storage grow independently, which is intentional. Projection
bugs can be repaired from immutable source versions. Consumer contracts survive
the POS switch, while source adapters and mappings can be replaced separately.

The archive still has accepted historical gaps for current-only APIs, deleted
configuration, and unavailable kitchen fulfillment. Those gaps and every manual
export are recorded explicitly.

Accepted gaps are durable register entries, not prose-only caveats. A null
export cadence means no known operator export can repair the historical gap;
API-uncovered enabled products are registered separately with their actual
monthly export procedure and immutable run evidence.
