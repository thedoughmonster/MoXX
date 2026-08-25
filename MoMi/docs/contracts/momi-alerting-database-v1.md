# MoMi Alerting Database V1

## Purpose

This contract defines private, source-neutral database objects that evaluate
complete owned order documents and create durable notification work. It does
not fetch source data or send Slack messages.

## Schemas

`momi_runtime` owns function and trigger registries. `momi_orders` owns durable
owned-API invocation work and attempts. `momi_alerting` owns alert
configuration and candidates. Destination adapters own their delivery work.

All three schemas are private. Public, anonymous, and authenticated roles
receive no access, and row-level security on their tables remains defense in
depth.

## Configuration

`momi_alerting.order_source_mappings` maps one source system and owned API
contract to configured payload paths and expected values. Each mapping has its
own enable switch and optional ISO currency code for presentation. Values use
`equals` or `not_equals`; `not_equals` never
matches a missing or JSON `null` value.

`momi_alerting.slack_destinations` stores named channel targets. Each
destination has an independent enable switch and channel id. No channel ids are
seeded by migrations.

`momi_alerting.alert_rules` stores alert kinds and rule versions. Rules are
disabled by default. One source and alert kind may have only one enabled rule
version.

`momi_alerting.alert_rule_conditions` stores ordered payload path/value
conditions. Paths remain source-contract configuration rather than code.

`momi_alerting.alert_routes` maps a configured source and alert kind to a Slack
destination. Routes are enabled separately from mappings, rules, and
destinations, so a channel can change without code changes.

No business mapping values are seeded by migrations.

## Candidate Claims

`momi_alerting.order_alert_candidates` stores durable claims. One row may exist
for each source system, order id, and alert kind:

```text
source_system + order_id + alert_kind
```

The row records the source mapping, API contract, destination, rule version,
generic API work identity, and immutable source-neutral order presentation.
`decision_context` preserves source work,
resource kind, source version, and migrated legacy provenance. There are no
cross-source foreign keys to raw source schemas.

## Decisions

`momi_alerting.claim_order_alert_candidates(bigint, jsonb, jsonb)` accepts one
durable API work id, its complete owned source payload, and the validated common
presentation. It verifies order identity, applies configured mapping and rule
conditions, refuses ambiguous matches, and claims at most one candidate for
each order identity and alert kind.

The matching API attempt stores the decision outcome. Raw-webhook eligibility
dispatches are not part of the active pipeline.

## Slack Work

Candidate insertion idempotently creates `momi_alerting.slack_delivery_work`.
The versioned prepared-message view renders Block Kit from the snapshotted
presentation and configured destination. It does not put a source order GUID in
the Slack payload. Those Slack relations belong to the Slack destination
adapter; their current direct candidate read remains removal-only access debt
until an order-alert-owned versioned view replaces it.

## Failure Behavior

Missing, disabled, or ambiguous mappings, rules, routes, or destinations claim
nothing. Persistence failures leave retryable durable API work and never mark
an alert as handled.
