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
- The complete parsed Toast payload unchanged as JSON.

Receipt metadata is stored outside the payload. The receiver never adds,
removes, renames, or maps fields inside the Toast document. This event record is
permanent and remains separate from full order resource versions in
`toast_raw.orders`.

The payload event GUID is unique. Replays and retries do not create another row.

For every newly stored raw event, a database trigger evaluates enabled webhook,
source, restaurant, and owned-reader mappings. A qualifying event with a
complete `details.order` object creates idempotent
`momi_orders.api_invocation_work` in the same transaction. That work names the
exact stored event version; it does not contain or copy the order document.
The receiver does not call another function or API after storage.

## Responses

- `200`: stored successfully or already stored.
- `400`: malformed JSON or required envelope fields missing.
- `401`: signature missing or invalid.
- `405`: unsupported HTTP method.
- `500`: persistence failed and Toast should retry.
- `503`: the hosted webhook secret is unavailable.

## Non-Goals

- No outbound API or Edge Function calls.
- No order-state interpretation or eligibility decisions.
- No Slack formatting or delivery.
- No source-field mapping.
- No relational normalization.
- No copy of the webhook order into the historical `toast_raw.orders` table.
- No GET-by-GUID hydration request from webhook receipt.
- No polling or reconciliation behavior.
