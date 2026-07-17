# Toast Order Ingest

## ELI5

Toast tells MoMi that an order changed. This service checks that the message
really came from Toast and saves the whole message. After the save, the database
hands the complete order already inside that message to MoMi's alert pipeline.

## Purpose

This source adapter owns webhook authentication, permanent event capture, and
the durable configured handoff of stored orders. It does not fetch orders,
decide whether to alert, or contact Slack.

## Owned Function

`toast-orders-webhook-ingest-v1` accepts Toast's signed webhook contract and a
health check. Its public route remains unchanged.

## Contracts

The service provides `toast.orders.webhook_ingest.v1` and consumes the
order-alerting owner's `toast.order.webhook_alert_work.v1`. The complete source
payload and exact signed body remain in archive-owned `toast_raw`; request
headers are intentionally discarded. The handoff carries only stored event,
order, location, and owned reader identity.

## Authority

The service may write `toast_raw` and `momi_orders`, read configured source and
reader mappings, read its webhook secret, and use the database connection. It
has no outbound network authority.

## Verification

Run `npm run check -- --service toast-order-ingest` with Node.js 24.
