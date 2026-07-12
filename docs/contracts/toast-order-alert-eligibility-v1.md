# Toast Order Alert Eligibility V1

## Purpose

This contract defines the first downstream decision point after raw Toast
webhook receipt. It identifies when a stored Toast order event should create
one alert candidate for later Slack delivery.

Raw ingest never calls this processor. A MoMi-owned worker or API may process a durable warehouse dispatch after reading its approved versioned view.

## Status

This raw-event contract is not approved for automation under ADR `0003`. It
remains disabled until a successor accepts an order GUID and reads the hydrated
order through the MoMi Order API.

## Input

`toast-order-alert-eligibility-v1` accepts `POST` requests containing:

```json
{"raw_event_id":"123"}
```

`raw_event_id` may be a positive decimal string or a positive safe integer.
Supabase JWT verification is disabled because current secret keys are not JWTs.
The handler requires the branch's exact default secret key in the `apikey`
header and reads the expected key from `SUPABASE_SECRET_KEYS`.

The service passes the id to a private warehouse function. Warehouse logic may inspect the complete stored payload, but service code does not query raw tables.

## Order Identity

Events are grouped by the Toast order GUID inside the source payload.

The Toast event GUID remains the delivery idempotency key for raw ingest only.
It must not be used as the order alert idempotency key because one order can
emit many legitimate webhook events.

## Eligibility

An event is alert-eligible when configured rules classify the order state as a
new alert-worthy transition.

Rules must live in database tables or views, not code constants. The initial
rules may classify Toast-owned fields such as source, payment status, approval
status, fulfillment state, revenue center, dining option, or item attributes.

Toast sources must be configurable and independently enabled or disabled.

Each source mapping stores the payload path and expected JSON value used to
identify that source, plus the payload path containing the Toast order GUID.
No source or order GUID path is hardcoded in service code.

Unknown or unmapped source values are not alert-eligible by default. They
should be preserved for review and made eligible only by an explicit mapping.

An enabled rule must have at least one condition, and every condition must
exactly match its configured payload path and JSON value. Only one version of a
rule may be enabled for a source and alert kind at a time.

The source, rule, route, and Slack destination must each be enabled. Multiple
matching sources for the same order and alert kind are ambiguous and create no
candidate.

## Idempotency

Only one alert candidate may be claimed for a Toast order GUID and alert kind.

Later webhook events for the same order must not create a duplicate candidate
unless a separate configured alert kind explicitly allows another transition.

The durable idempotency key is:

```text
toast_order_guid + alert_kind
```

## Output

The processor writes durable alert candidates for a later notification service.

A successful response reports whether the event exists, candidate counts and
ids, and whether the dispatch had already completed.

Processing and dispatch completion are atomic. The processor locks the durable
dispatch for the raw event, increments its attempt count, claims candidates,
stores the complete outcome, and marks the dispatch complete in one database
transaction. A completed dispatch returns its stored outcome without evaluating
changed configuration again.

Each candidate includes the Toast order GUID, configured source and destination
keys, alert kind, causing raw event, rule version, and claim timestamp.

Slack channel ids are configured in the database. Message formatting, retries,
and delivery status are owned by a later notification service.

## Failure Behavior

If eligibility cannot be decided because a required configured rule is missing,
the event must remain unclaimed and reviewable. The processor should not guess.

If candidate persistence or dispatch completion fails, the dispatch remains
pending. The handler records a generic failure when the database is available,
and a later invocation may retry the whole transaction safely.

Missing raw events return `404`. Invalid requests return `400`, unsupported
methods return `405`, non-service callers return `403`, and database failures
return `500`.

## Non-Goals

- No source or vendor API calls.
- No direct raw-table reads in service code.
- No synchronous eligibility work in `toast-orders-webhook-ingest-v1`.
- No Slack message formatting or delivery.
- No hardcoded business value lists in code.
- No relational normalization of the raw Toast payload.
- No cross-source joins.
