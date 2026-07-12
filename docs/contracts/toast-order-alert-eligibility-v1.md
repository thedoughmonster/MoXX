# Toast Order Alert Eligibility V1

## Purpose

This contract defines the first downstream decision point after raw Toast
webhook receipt. It identifies when a stored Toast order event should create
one alert candidate for later Slack delivery.

The raw ingest function remains unchanged. It only authenticates and stores
Toast events.

## Input

The eligibility processor reads from `toast_raw.order_webhook_events`.

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

Unknown or unmapped source values are not alert-eligible by default. They
should be preserved for review and made eligible only by an explicit mapping.

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

## Non-Goals

- No changes to `toast-orders-webhook-ingest-v1`.
- No Slack message formatting or delivery.
- No hardcoded business value lists in code.
- No relational normalization of the raw Toast payload.
- No cross-source joins.
