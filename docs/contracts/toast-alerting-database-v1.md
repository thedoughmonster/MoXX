# Toast Alerting Database V1

## Purpose

This contract defines private database objects used after raw Toast webhook
storage to claim alert candidates for later notification delivery.

It provides the durable handoff from raw ingest but does not send Slack messages.

## Schema

`toast_alerting` is private. Public, anonymous, and authenticated roles receive
no access, and row level security is enabled as defense in depth.

## Configuration

`toast_alerting.toast_sources` stores named Toast source mappings. Each source
has its own enabled flag so a source can be turned on or off without changing
rules or Slack destinations. Source and order GUID payload paths are stored as
configuration rather than hardcoded in a service.

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
exact JSON equality, requires every rule condition to match, and refuses to
claim an ambiguous source match.

## Candidate Claims

`toast_alerting.order_alert_candidates` stores durable alert claims.

One row may exist for each Toast order GUID and alert kind. The row records the
source, destination, raw webhook event, and rule version used.

The unique claim key is:

```text
toast_order_guid + alert_kind
```

## Dispatches

`toast_alerting.order_alert_dispatches` stores one durable eligibility dispatch
per raw Toast event. An `AFTER INSERT` trigger creates it in the same transaction
as the raw event, before the ingest function schedules background processing.

Each dispatch records its queue time, most recent attempt, attempt count,
completion time, generic failure text, and the complete eligibility outcome.
Pending dispatches remain queryable for a later reconciliation service.

`toast_alerting.process_order_alert_dispatch(bigint)` serializes concurrent
attempts for one event. Candidate claiming and dispatch completion happen in the
same transaction. Completed dispatches return their stored outcome and do not
re-evaluate later configuration changes.

## Ownership

The alerting schema owns Toast-only dispatch, eligibility state, and destination
routing.
Slack message formatting, delivery attempts, and cross-source joins belong to
later services or explicit views.

## Failure Behavior

If a matching source, rule, route, or destination is missing or disabled, no
candidate is claimed.

If candidate persistence fails, the processor should retry later rather than
marking the alert as handled.
