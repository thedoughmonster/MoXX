# Toast Alerting Database V1

## Purpose

This contract defines private database objects used after Toast order hydration
to claim alert candidates for later notification delivery. It does not send
Slack messages.

## Schema

`toast_alerting` is private. Public, anonymous, and authenticated roles receive
no access, and row level security is enabled as defense in depth.

## Configuration

`toast_alerting.toast_sources` stores named Toast source mappings. Each source
has its own enabled flag so a source can be turned on or off without changing
rules or Slack destinations. Source and order GUID payload paths are stored as
configuration rather than hardcoded in a service. Each source also configures
an `equals` or `not_equals` comparison. A `not_equals` source never matches a
missing or JSON `null` value.

`toast_alerting.slack_destinations` stores named Slack channel targets. Each
destination has its own enabled flag and channel id. No channel ids are seeded
by the migration.

`toast_alerting.alert_rules` stores alert kinds and rule versions.

Rules are disabled by default. Enabling a rule is an explicit operational act
after its configured conditions are reviewed. A source and alert kind may have
only one enabled rule version.

`toast_alerting.alert_rule_conditions` stores ordered payload path/value
conditions for each rule. Conditions use Toast payload paths and JSON values so
source fields stay in their original structure.

`toast_alerting.alert_routes` maps a Toast source and alert kind to a Slack
destination. Routes are enabled separately from sources, rules, and
destinations so channel changes do not require code changes.

No initial business values are seeded by the migration.

Eligibility is evaluated atomically by a private database function. It uses
the configured source comparison, requires every rule condition to match by
exact JSON equality, and refuses to claim an ambiguous source match.

## Candidate Claims

`toast_alerting.order_alert_candidates` stores durable alert claims.

One row may exist for each Toast order GUID and alert kind. The row records the
source, destination, rule version, hydrated resource version, Order API work,
and causing raw webhook event when one exists.

The unique claim key is:

```text
toast_order_guid + alert_kind
```

## Hydrated Decisions

`toast_alerting.claim_hydrated_order_alert_candidates(bigint, jsonb)` accepts
one durable Order API work id and its complete owned API response. It verifies
the order identity, applies configured rules, and claims at most one candidate
for each order GUID and alert kind.

The durable Order API work row records decision attempts and outcomes. Raw-event
eligibility dispatches are not part of the active pipeline.

## Ownership

The alerting schema owns Toast eligibility state and destination routing.
Slack message formatting, delivery attempts, and cross-source joins belong to
later services or explicit views.

## Failure Behavior

If a matching source, rule, route, or destination is missing or disabled, no
candidate is claimed.

If candidate persistence fails, the processor should retry later rather than
marking the alert as handled.
