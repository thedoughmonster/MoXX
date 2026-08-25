# Retired Edge Functions Dev Cleanup

- Date: 2026-07-13
- Environment: persistent Supabase `dev` branch
- Result: passed
- Production changed: no

## Removed Deployments

- `toast-orders-probe`
- `toast-order-alert-eligibility-v1`

The probe already returned HTTP 410 and had no repository, registry, or trigger
reference. The raw eligibility function had no active registry or trigger
reference and was superseded by the hydrated order alert pipeline.

## Database Cleanup

Migration `20260713061129_remove_legacy_raw_alert_dispatch` removed:

- `toast_alerting.order_alert_dispatches`
- `toast_alerting.enqueue_order_alert_dispatch()`
- `toast_alerting.process_order_alert_dispatch(bigint)`
- `toast_alerting.claim_order_alert_candidates(bigint)`

Before removal, the dispatch table contained zero rows and no candidate existed
without hydrated Order API provenance. The cleanup migration was validated in a
rolled-back transaction before it was applied.

## Retained Pipeline

Five Edge Functions remain active:

- `toast-orders-webhook-ingest-v1`
- `toast-orders-fetch-by-guid-v1`
- `momi-orders-get-by-guid-v1`
- `toast-order-alert-worker-v1`
- `slack-order-alert-delivery-v1`

The private hydrated candidate claim function remains present. Four owned
function registrations and four trigger registrations remain active.

## Repository Cleanup

The retired eligibility directory, its three dedicated tests, and its function
configuration were removed. A regression test now prevents either retired
function from returning to active source or configuration.

## Verification

- Node: `24.14.0`
- Tests: `18` passed, `0` failed
- Supabase advisors: no security or performance warnings or errors
- Handwritten files: all at or below `120` lines
