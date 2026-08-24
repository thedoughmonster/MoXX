# Order Alerting

## ELI5

MoMi gives this service a saved order. It checks the configured alert rules,
takes one readable snapshot, and records one candidate for every enabled
destination. It does not know how to talk to Toast or Slack.

## Purpose

This source-neutral capability owns order alert decisions, idempotent candidate
claims, destination fan-out, and presentation snapshots. Destination adapters
own their durable delivery work.

## Owned Function

`momi-order-alert-worker-v1` claims one capability-authorized event delivery,
creates one canonical API work row for exact `warehouse.order.observed`, and
invokes only the registered `momi.orders.get_by_version.v1` route.
Each canonical attempt mints a short-lived capability scoped to that order and
revokes it before evaluating the response; delivery and alert work tokens are
never forwarded as canonical reader authority.

New canonical attempts wrap the unchanged legacy issuer with the
warehouse-owned `momi.order_alert_delivery.v2` binding command in the same
transaction. The wrapper passes the exact issued read identity and delivery
tuple once, while warehouse-read owns tuple authorization and cleanup.

## Contracts

The active business path consumes the event delivery lifecycle and exact
`momi.orders.get_by_version.v1`, plus the private
`momi.order_alert_delivery.v2` binding command. `order-alerting` is the only permitted current
consumer of the retiring `momi.toast_orders.get_by_id.v1` contract. That branch
is limited to already-created legacy invocation work and bounded repair or
rollback compatibility; it is not a normal path and cannot admit a new service
consumer. The current Slack view still reads the candidate snapshot directly;
that transition access is removal-only constitution debt until an
owner-controlled versioned read view replaces it.

## Dual-Run Safety

The bridge records one event-to-work relationship. Canonical decisions reuse
the source system and source order ID carried by the authoritative event, so
the existing candidate uniqueness key deduplicates old and new paths. Only
`warehouse.order.observed` is operational; archived, reconciled, and unknown
order events are acknowledged without creating work or alerts.

The initial release stages `order-alerting-v1` inactive because migrations
deploy before worker code. The activation migration verifies the hosted exact
reader and worker, fences duplicates across the transitional and canonical
paths, disables new legacy work, and starts the subscription at a bounded
handoff watermark. Existing terminal legacy records remain available for
repair while every new alert starts from the canonical warehouse event.

The Toast compatibility branch stays available while any legacy invocation
work is unresolved or a separately approved historical hydration repair can
still complete. Unknown callers, late hydration work, registry ambiguity, or a
failed canonical acceptance event preserves the branch and stops retirement.

## Authority

The service can read runtime configuration and order work, then write alert and
delivery state. It cannot call Toast, Square, Slack, or another vendor.

## Verification

Run `npm run check -- --service order-alerting` with Node.js 24.
