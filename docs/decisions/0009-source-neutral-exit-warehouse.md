# 0009: Source-Neutral Exit Warehouse

- Status: accepted
- Date: 2026-07-14
- Supersedes: the source-specific reader direction in 0003

## Context

Dough Monster plans to leave Toast. Operational services must survive a new
point-of-sale system, and history must remain reconstructable without vendor
access. Source DTOs and IDs had reached order alerts; independent pollers would
also repeat calls and leave uneven raw history. Webhooks do not cover every
payment, cash, labor, configuration, kitchen, device, or historical resource.

## Source Boundaries

Toast names and schemas stop at three boundaries:

1. `toast-webhook-ingestion` authenticates and stores complete inbound events.
2. `toast-data-acquisition` is the only Toast credential holder and API caller.
3. `toast_raw` stores exact attempts, responses, versions, and observations.

This decision does not change either external HTTP edge: Toast still sends
webhooks to ingestion, and acquisition still calls Toast. Projection never
crosses a source network boundary.

## Durable Events

`momi-event-routing` stores append-only `source.toast.*` and `warehouse.*` event
metadata, then sends reference-only messages to a private PGMQ queue per
subscriber. Delivery remains at-least-once with an exact event/message/token
claim, a 120-second lease, retry from 15 seconds to one hour, and dead-lettering
on attempt 12. Business services may subscribe only to `warehouse.*`.

## Canonical Projection

Stable DM UUIDs are linked to source keys through the crosswalk. Resource types
normalize as follows: restaurant/location to location; menu configuration to
menu; stock/catalog items to menu item; pre-modifier types to modifier types;
ordering schedule/shift to schedule; and menu reference suffixes to their base
menu types.

`canonical-resource-v2` stores DM identity and maps source vocabulary into:

- name/description plus normalized status, active, and archived state;
- payment amount, tip, dates, void state, payment type, and card type;
- person identity and contact fields;
- schedule/labor dates, hours, wages, clock-out, job, tip, and report fields;
- dining behavior/curbside; and
- rich menu names, media, channels, tags, pricing, SKU/PLU, nutrition,
  selection rules, sort order, deleted state, and online-orderable state.

Nulls are omitted. Source identity, content hash, raw observation reference,
freshness, and `projection_contract` remain in provenance, not the canonical
document. Revision-two versions and events use schema version 2.

## Replay And Reads

Revision-two replay is append-only and set-based. It derives documents from
immutable raw versions and observations, inserts idempotent canonical versions
by content identity, links every observation, and emits one reconciliation
event per version. It neither refetches Toast nor deletes or rewrites v1 history.

Canonical reads normally choose the latest version. For the menu family, a
complete published menu document with provenance `resource_type = menu` ranks
ahead of sparse configuration/reference snapshots before recency is considered.
Exact source reconstruction remains a privileged archive concern.

## Projection Scheduling

Projection no longer uses a delivery trigger, `pg_net` HTTP post, or Edge
recovery wakeup. Every three seconds, a database procedure processes up to six
due deliveries within a 60-second budget. Each iteration locks and claims one
delivery, commits its lease, then independently commits projection/acknowledgment
or failure. An `edge`/`database` mode fences reservations during cutover.
Existing capability rotation, retry, lease, and dead-letter semantics remain.

Database configuration still owns source capture windows and cadence. Cron
creates or reconciles durable work. ADR 0004 remains unchanged for other
allowlisted internal adapters; it is no longer used to wake projection.

## Compatibility

`momi.toast_orders.get_by_id.v1` remains during migration;
`momi.orders.get_by_id.v1` replaces it. Order alerting moves to canonical order
events and the new reader before the source reader is retired.

## Consequences

Raw and canonical storage grow independently. Projection bugs can be repaired
from immutable source history without source access. Consumer contracts survive
the POS switch, while adapters and mappings can change independently.

Accepted historical gaps and every manual export remain explicit durable
records. A null export cadence means no operator export can repair that gap;
API-uncovered enabled products record their actual recurring export procedure.
