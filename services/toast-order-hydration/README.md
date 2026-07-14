# Toast Order Hydration

## ELI5

MoMi may have a deliberate reconciliation job for one Toast order. This service
claims that job, asks Toast for exactly that order, and saves the whole answer.
Normal order webhooks do not create these jobs.

## Purpose

This is the only service permitted to fetch Toast order business data. It owns
explicit hydration, idempotent response storage, and fetch attempt history. It
is not on the operational webhook-to-Slack path.

## Owned Function

`toast-orders-fetch-by-guid-v1` performs one configured operation:
`GET /orders/v2/orders/{guid}`. It is not a generic Toast proxy.

## Contracts

The service provides the complete source operation plus
`momi.order_api.invocation_work.v1` after persistence. Its durable jobs are
created only by a separately approved reconciliation or operator workflow.

## Authority

Toast host and restaurant values come from database configuration. Secret names
are configured; values remain in Supabase. No report or read path invokes this
service synchronously.

## Verification

Run `npm run check -- --service toast-order-hydration` with Node.js 24.
