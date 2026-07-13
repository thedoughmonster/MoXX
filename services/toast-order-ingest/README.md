# Toast Order Ingest

## ELI5

Toast tells MoMi that an order changed. This service checks that the message
really came from Toast, saves the whole message, and stops. Database-owned work
may begin only after that save succeeds.

## Purpose

This source adapter owns webhook authentication and permanent event capture. It
does not hydrate orders, decide whether to alert, or contact Slack.

## Owned Function

`toast-orders-webhook-ingest-v1` accepts Toast's signed webhook contract and a
health check. Its public route remains unchanged.

## Contracts

The service provides `toast.orders.webhook_ingest.v1` and durable
`toast.order.hydration_work.v1`. The complete source body and received headers
remain in `toast_raw.order_webhook_events`.

## Authority

The service may write `toast_raw`, read its webhook secret, and use the database
connection. It has no outbound network authority.

## Verification

Run `npm run check -- --service toast-order-ingest` with Node.js 24.
