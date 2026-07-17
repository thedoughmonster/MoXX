# Toast Order Hydration

## ELI5

MoMi may have a deliberate reconciliation job for one Toast order. This service
claims that job, asks Toast for exactly that order, and saves the whole answer.
Normal order webhooks do not create these jobs.

## Purpose

This is the retiring order-specific adapter for explicit hydration, idempotent
response storage, and fetch attempt history. `toast-data-acquisition` is the
permanent outbound Toast owner. This service is not on the operational
webhook-to-Slack path and accepts no new acquisition responsibilities.

## Owned Function

`toast-orders-fetch-by-guid-v1` performs one configured operation:
`GET /orders/v2/orders/{guid}`. It is not a generic Toast proxy.

## Contracts

The service provides the complete source operation and consumes the
order-alerting owner's `momi.order_api.invocation_work.v1` handoff. Its durable
jobs are created only by a separately approved reconciliation or operator
workflow.

## Authority

Toast host and restaurant values come from database configuration. Secret names
are configured; values remain in Supabase. This adapter retains a temporary
Toast credential and API exception only while its manifest is `retiring`. No
report or read path invokes it synchronously.

## Verification

Run `npm run check -- --service toast-order-hydration` with Node.js 24.
