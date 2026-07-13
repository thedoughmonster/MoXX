# Toast Order Hydration

## ELI5

MoMi has a saved job saying which Toast order is missing. This service claims
that job, asks Toast for exactly that order, saves the whole answer, and then
creates durable work for MoMi's own order reader.

## Purpose

This is the only service permitted to fetch Toast order business data. It owns
scheduled hydration and re-hydration, idempotent response storage, and fetch
attempt history.

## Owned Function

`toast-orders-fetch-by-guid-v1` performs one configured operation:
`GET /orders/v2/orders/{guid}`. It is not a generic Toast proxy.

## Contracts

The service consumes `toast.order.hydration_work.v1` and provides the complete
source operation plus `momi.order_api.invocation_work.v1` after persistence.

## Authority

Toast host and restaurant values come from database configuration. Secret names
are configured; values remain in Supabase. No report or read path invokes this
service synchronously.

## Verification

Run `npm run check -- --service toast-order-hydration` with Node.js 24.
