# MoMi Order Alert Pipeline V1

## Purpose

This contract turns one complete owned order document into configured Slack
delivery work. The decision and delivery stages are source-neutral, durable,
independently retryable, and idempotent.

## Source Handoff

A source-specific hydration adapter first stores the complete source response.
In the same committed transaction it creates `momi_orders.api_invocation_work`
with source, resource version, order, location, and owned API contract identity.

Toast currently records `momi.toast_orders.get_by_id.v1`. A future Square
hydrator records its Square reader contract instead. Neither the alert worker
nor Slack adapter needs a source-specific implementation change.

## Decision Input

`momi.orders.alert.evaluate.v1` accepts only `work_id` and that work row's
capability token. It atomically claims the work and resolves the exact active
owned reader route from `momi_runtime` configuration.

The worker sends `work_id`, `order_id`, and `trigger_token` to that reader. It
requires the common owned response envelope to match the claimed contract,
source system, order id, and immutable source version. It also requires the
reader's common order-presentation contract before passing both documents to
the database decision function.

The worker never reads a raw table or approved source view directly and never
calls Toast, Square, or Slack.

## Eligibility

Source mappings, rules, routes, and Slack destinations have independent enable
switches. Mapping paths are evaluated against the complete source payload
returned by the configured owned reader.

Exactly one matching route claims one candidate for:

```text
source_system + order_id + alert_kind
```

Ambiguous or unmapped matches claim nothing and remain visible in the work
outcome. Candidate context preserves source work, resource kind, and source
version identities without cross-source raw-table foreign keys.

## Slack Delivery

A claimed candidate snapshots the readable order presentation and creates
durable Slack delivery work before any network call. The prepared-message view
renders accessible Slack Block Kit with order number, schedule, total, items,
and modifiers. Source order GUIDs never enter the Slack payload.

`momi.slack.order_alert.deliver.v1` accepts only the delivery work id and
capability token, loads that prepared message, and calls Slack
`chat.postMessage` with the configured channel.

The candidate id is the delivery idempotency key. Attempts store timestamps,
deployment identity, Slack status, safe response metadata, and errors. A
successful delivery is never sent again by a retry.

## Failure Behavior

Reader, decision, or Slack failures leave durable failed work that can be
reclaimed. No stage falls back to a source API, raw table, or hardcoded channel.
Disabled sources, rules, routes, or destinations produce no candidate or
message.
