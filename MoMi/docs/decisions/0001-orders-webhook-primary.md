# 0001: Orders Webhook Is The Primary Change Feed

- Status: accepted
- Date: 2026-07-12

## Context

Toast historically required polling to discover in-store orders. A controlled
production test created an in-store order and then fulfilled it. The listener
received two successful POST requests, matching those two lifecycle changes.

## Decision

Use the Toast Orders webhook as the primary low-latency order change feed.
Treat each event as an immutable delivery and preserve it before downstream work.

Retain a future `/ordersBulk` reconciliation poller as a separate callable
service. Its cadence and recovery window will be decided in its own contract.

## Consequences

- Slack latency no longer depends on a one-minute polling interval.
- One order can generate many legitimate events.
- Event GUID idempotency and order GUID state tracking are separate concerns.
- Alert eligibility must be decided downstream, not in the raw receiver.
