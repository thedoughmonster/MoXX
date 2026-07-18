# Toast Order Read API

## ELI5

This service opens an exact Toast order saved by webhook or hydration and hands
back the full document plus a readable presentation. It never asks Toast for
anything.

## Purpose

This source-specific read facade protects the warehouse boundary. It validates
durable work capability, reads an approved versioned view, and returns the
complete source payload separately from its source-neutral presentation. It
owns no dataset.

## Owned Function

`momi-toast-orders-get-by-id-v1` keeps its existing route and contract. A future
Square reader can provide its own source contract without changing Toast history.

## Contracts

The service provides `momi.toast_orders.get_by_id.v1`. The order-alerting service
consumes this exact registered contract and validates the returned identity.
The facade consumes `momi.warehouse.toast_order_read_view.v1` from
`warehouse-projection` for its one approved database view.

## Authority

The service may read `momi_orders` authorization work and `momi_api` views. It
cannot write durable state or call Toast, Slack, or another external API.

## Verification

Run `npm run check -- --service toast-order-read-api` with Node.js 24.
