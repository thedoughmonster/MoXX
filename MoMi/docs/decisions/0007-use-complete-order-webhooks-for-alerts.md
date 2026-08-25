# 0007: Use Complete Order Webhooks for Operational Alerts

- Status: accepted
- Date: 2026-07-14
- Approval: explicit user approval

## Context

Toast's current order webhook stores a complete order object at
`details.order`, including readable item and modifier names. The operational
alert path was still using the order GUID to queue a second GET-by-GUID call,
store another copy, and then read that copy back through MoMi's owned API.

That duplicate acquisition adds latency, failure modes, source traffic, and
coordination without improving the Slack alert. Historical reporting has a
different freshness requirement and will use bulk reconciliation rather than
one API request for every webhook lifecycle event.

## Decision

Every signed webhook remains permanently and idempotently stored in
`toast_raw.order_webhook_events` before downstream work begins.

For operational alerts, expose the exact complete `details.order` object as an
immutable Toast source version. Its version identity is the webhook event GUID,
prefixed with `webhook:` so it cannot collide with hydrated row identities. A
database view computes metadata without copying or changing the source JSON.

After the raw insert commits, configured database handoff creates the existing
`momi_orders.api_invocation_work` directly. The existing owned Toast reader,
source-neutral alert worker, rules, destination fanout, presentation, and Slack
delivery path remain unchanged. No alert component calls Toast.

The webhook no longer creates GET-by-GUID hydration work. The existing
hydration function and tables remain available while their later
reconciliation role is designed; retiring them is a separate change.

Historical Toast order storage remains separate from alert storage. Future
bulk reconciliation must consider all webhook events, including late voids and
refunds, and update permanent order history idempotently. It must not be
required for operational alert delivery.

This decision supersedes only the webhook-to-GET alert handoff described in
ADR 0003. Warehouse-first access, raw preservation, owned API reads, durable
work, and destination isolation remain mandatory.

## Consequences

- A webhook is acknowledged only after its full source event is durable.
- Slack can receive readable items and modifiers without a Toast API call.
- One event produces at most one API work row per owned reader contract.
- Existing candidate and delivery keys continue to prevent duplicate sends.
- Source, rule, route, and destination enable switches remain independent.
- Historical backfill and reconciliation can evolve without delaying alerts.
