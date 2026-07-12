# Toast Order Alert Eligibility V1

## Purpose

This contract defines the first downstream decision point after raw Toast
webhook receipt. It identifies when a stored Toast order event should create
one alert candidate for later Slack delivery.

The raw ingest function remains unchanged. It only authenticates and stores
Toast events.

## Input

`toast-order-alert-eligibility-v1` accepts `POST` requests containing:

```json
{"raw_event_id":"123"}
```

`raw_event_id` may be a positive decimal string or a positive safe integer.
Supabase JWT verification remains enabled, and the handler also requires the
branch service-role credential because anonymous legacy keys are valid JWTs.

The processor reads that row from `toast_raw.order_webhook_events`.

It may inspect the complete stored Toast payload and receipt metadata, but it
must not alter, enrich, or delete raw rows.

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

A successful response reports whether the event exists, the numbers of matched,
ambiguous, and newly claimed candidates, and newly created candidate ids.

Each candidate must include:

- Toast order GUID.
- Configured source key.
- Alert kind.
- Configured Slack destination key.
- The raw webhook event row that caused the claim.
- The rule or mapping version used for the decision.
- Claim timestamp.

Slack channel ids are configured in the database. Message formatting, retries,
and delivery status are owned by a later notification service.

## Failure Behavior

If eligibility cannot be decided because a required configured rule is missing,
the event must remain unclaimed and reviewable. The processor should not guess.

If candidate persistence fails, the processor must retry later rather than
acknowledging the alert as handled.

Missing raw events return `404`. Invalid requests return `400`, unsupported
methods return `405`, non-service callers return `403`, and database failures
return `500`.

## Non-Goals

- No changes to `toast-orders-webhook-ingest-v1`.
- No automatic database webhook or scheduling configuration.
- No Slack message formatting or delivery.
- No hardcoded business value lists in code.
- No relational normalization of the raw Toast payload.
- No cross-source joins.
