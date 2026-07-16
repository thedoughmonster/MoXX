# Order Alerting

## ELI5

MoMi gives this service a saved order. It checks the configured alert rules,
takes one readable snapshot, and creates one delivery job for every enabled
destination. It does not know how to talk to Toast or Slack.

## Purpose

This source-neutral capability owns order alert decisions, idempotent candidate
claims, destination fan-out, presentation snapshots, and durable delivery work.

## Owned Function

`momi-order-alert-worker-v1` claims one capability-authorized event delivery,
creates one canonical API work row for exact `warehouse.order.observed`, and
invokes only the registered `momi.orders.get_by_version.v1` route.
Each canonical attempt mints a short-lived capability scoped to that order and
revokes it before evaluating the response; delivery and alert work tokens are
never forwarded as canonical reader authority.

## Contracts

The active business path consumes the event delivery lifecycle and exact
`momi.orders.get_by_version.v1`. The latest-version canonical reader and old
`momi.toast_orders.get_by_id.v1` work path remain available only for dual-run
compatibility. It provides
`momi.order_alert.delivery_work.v1` for destination adapters.

## Dual-Run Safety

The bridge records one event-to-work relationship. Canonical decisions reuse
the source system and source order ID carried by the authoritative event, so
the existing candidate uniqueness key deduplicates old and new paths. Only
`warehouse.order.observed` is operational; archived, reconciled, and unknown
order events are acknowledged without creating work or alerts.

This release stages `order-alerting-v1` with the exact event name and leaves it
inactive because migrations deploy before worker code. The readiness view
`momi_alerting.order_event_cutover_readiness_v1` checks the canonical reader,
worker route, configured rule paths, duplicate constraint, and token-fenced
delivery lifecycle.
A follow-up migration may activate the subscription only after the deployed
worker is verified and every readiness flag is true.

## Authority

The service can read runtime configuration and order work, then write alert and
delivery state. It cannot call Toast, Square, Slack, or another vendor.

## Verification

Run `npm run check -- --service order-alerting` with Node.js 24.
