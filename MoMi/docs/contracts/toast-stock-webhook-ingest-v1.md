# Toast Stock Webhook Ingest V1

## Request

- Method: `POST`
- Content type: `application/json`
- Authentication header: `Toast-Signature`
- Body: Toast Stock webhook event JSON

The payload must contain non-empty string values for `timestamp` and `guid`,
`eventCategory` must be `stock`, and `eventType` must be `in_stock`,
`low_quantity`, or `out_of_stock`.

## Authentication

The receiver computes HMAC-SHA256 over the exact body followed by the payload
timestamp. It verifies the Base64 signature using
`TOAST_STOCK_WEBHOOK_SECRET`.

## Persistence

One row is attempted in `toast_raw.stock_webhook_events` with:

- Supabase receipt timestamp.
- All request headers as JSON.
- The complete parsed Toast payload unchanged as JSON.

Receipt metadata is stored outside the payload. The receiver never adds,
removes, renames, or maps fields inside the Toast document. The payload event
GUID is unique. Replays and retries do not create another row.

## Responses

- `200`: stored successfully or already stored.
- `400`: malformed JSON, required envelope fields missing, or non-stock event.
- `401`: signature missing or invalid.
- `405`: unsupported HTTP method.
- `500`: persistence failed and Toast should retry.
- `503`: the hosted webhook secret is unavailable.

## Non-Goals

- No outbound API or Edge Function calls.
- No current-stock calculation.
- No stock-state interpretation or eligibility decisions.
- No Slack formatting or delivery.
- No source-field mapping.
- No relational normalization.
