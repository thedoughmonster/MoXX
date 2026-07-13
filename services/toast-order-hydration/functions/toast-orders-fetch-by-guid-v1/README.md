# Toast Order Fetch by GUID v1

## ELI5

MoMi gives this function one saved fetch job. It gets the complete order from
Toast, files the untouched JSON in the warehouse, records what happened, and
leaves one deduplicated work item for MoMi's own order API. It does nothing
with alerts or Slack.

## Purpose

This hydration adapter acquires one complete Toast order for durable warehouse
work. It is the only function in the current slice allowed to call Toast.

- Function key: `toast.orders.fetch_by_guid.v1`
- Route: `/functions/v1/toast-orders-fetch-by-guid-v1`
- Owner: `toast-order-hydration`
- Boundary: Toast outbound

## Trigger And Input

`POST` accepts only `job_id` and that job's `trigger_token`; see
`contracts/input.schema.json`. Supabase gateway JWT verification is disabled
because authorization is bound to the durable job row and private token.

## Output

The response reports the durable claim and storage disposition plus attempt and
resource-version identifiers. It never returns Toast credentials or order JSON.

## Durable Flow

1. Atomically claim eligible configured work and create an attempt.
2. Resolve the Toast host, restaurant, timeout, and credential secret names
   from enabled database configuration.
3. Authenticate with Toast and call only `GET /orders/v2/orders/{guid}`.
4. Persist the complete response and safe metadata before reporting success.
5. Deduplicate identical resource content and queue source-neutral MoMi Order
   API work with its Toast provenance.

Retries are idempotent, and every attempt remains visible even when the source
is unavailable or its response is invalid.

## Side Effects

The function records every hydration attempt, stores complete immutable Toast
order versions, updates the durable job, and queues deduplicated owned-API work.

## Failure Handling

Authentication, network, HTTP, and contract failures are recorded with safe
metadata. The durable job becomes retryable without deleting prior attempts or
any successfully stored source version.

## Authority Boundary

This function may call the configured Toast authentication and order endpoints.
It never evaluates alerts, serves application reads, or calls Slack.

## Configuration

- `SUPABASE_DB_URL`: private database connection supplied by Supabase.
- `MOMI_CODE_COMMIT_SHA`: deployed source revision recorded with attempts.
- Toast credential secret names and all non-secret source values are configured
  in the warehouse, not hardcoded here.

## Tests

See the [function manifest](function.json), [service rules](../../AGENTS.md),
and [hydration contract](../../../../docs/contracts/toast-order-hydration-v1.md).
Run `npm run check -- --service toast-order-hydration` from the repository root.
