# Toast Order Slack Alert Dev Verification

- Date: 2026-07-12
- Environment: persistent Supabase `dev` branch
- Result: passed
- Production changed: no

## Test Order

- Toast order GUID: `b6edc62f-3776-4ee5-8ae4-a500194e21d1`
- Restaurant GUID: `7b84bb81-3660-4215-a571-39cbad9611d2`
- Source: `In Store`
- Destination: private `momi-dev-alerts` (`C0BGPEE4A4V`)

## Pipeline Evidence

- Hydration job `3` succeeded in one attempt.
- Full Toast response was stored as order version `3` in `toast_raw.orders`.
- Owned Order API work `3` succeeded in one attempt.
- Eligibility produced exactly one candidate, `8`.
- Slack delivery work `2` succeeded with exactly one attempt row.

## Slack Evidence

- Sender: `Dough Monster Ops`
- Message timestamp: `1783878320.008529`
- Message text:

```text
New Toast In Store order
Order: b6edc62f-3776-4ee5-8ae4-a500194e21d1
```

## Persistence Correction

Slack accepted the first delivery, but the success writer initially returned
HTTP 500 because dynamic values inside `jsonb_build_object` lacked explicit
Postgres types. Database logs reported `could not determine data type of
parameter $7`.

The success and failure writers now cast those values explicitly. Function
`slack-order-alert-delivery-v1` version `4` was deployed, and the already-sent
message was reconciled by its exact channel and timestamp without replaying it.

## Idempotency Evidence

An internal replay of delivery work `2` returned HTTP 200 with disposition
`already_succeeded`. A fresh Slack channel read still showed exactly one order
alert, with the original timestamp.

## Enabled Dev Configuration

- Worker triggers: `2`
- Business switches: source, rule, route, and destination (`4`)
- Source key: `toast_in_store`
- Destination key: `momi_dev_alerts`
