# Toast Orders Webhook Ingest V1

## Request

- Method: `POST`
- Content type: `application/json`
- Authentication header: `Toast-Signature`
- Body: Toast Orders webhook event JSON

The payload must contain non-empty string values for `timestamp` and `guid`.
No other source field is required or removed by this receiver.

## Authentication

The receiver computes HMAC-SHA256 over the exact body followed by the payload
timestamp. It verifies the Base64 signature using
`TOAST_ORDERS_WEBHOOK_SECRET`.

## Persistence

One row is attempted in `toast_raw.order_webhook_events` with:

- Supabase receipt timestamp.
- All request headers as JSON.
- The complete parsed Toast payload as JSON.

The payload event GUID is unique. Replays and retries do not create another row.

After durable storage, the receiver schedules
`toast-order-alert-eligibility-v1` with only the raw event row id. This work runs
as a background task and does not delay Toast's response. A replay schedules the
same id safely so an incomplete downstream attempt can be retried.

Every newly stored raw event also receives a durable pending dispatch row from
the database trigger defined by the alerting database contract. Eligibility
completion, rather than the HTTP handoff itself, marks that dispatch complete.

## Responses

- `200`: stored successfully or already stored.
- `400`: malformed JSON or required envelope fields missing.
- `401`: signature missing or invalid.
- `405`: unsupported HTTP method.
- `500`: persistence failed and Toast should retry.
- `503`: the hosted webhook secret is unavailable.

A downstream invocation failure does not change a successful raw receipt into
an ingest failure. Its dispatch remains pending for a later retry.

## Non-Goals

- No order-state interpretation or eligibility decisions.
- No Slack formatting or delivery.
- No source-field mapping.
- No relational normalization.
- No polling or reconciliation behavior.
